import { Injectable, InternalServerErrorException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { ClientEncryption, MongoClient } from "mongodb";
import { CMKCredentials } from "./interfaces/cmk.interface";
import {KMSProviders } from "./interfaces/kms.interface";

export interface AutoEncryptionOptions {
    schemaMap?: Document;
    bypassAutoEncryption?: boolean;
    keyVaultNamespace: string;
    kmsProviders?: KMSProviders;
    extraOptions?: {
        cryptSharedLibPath?: string;
    },
    tlsOptions?: {
        [kmsProvider: string]: object;
    }
}

@Injectable()
export class EncryptionHelper {
    constructor(private configService: ConfigService) { }


    getKMSProviderCredentials(kmsProviderName: string): KMSProviders {
        let kmsProviders: KMSProviders;

        switch (kmsProviderName) {
            case "aws":
                kmsProviders = {
                    aws: {
                        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'), // Your AWS access key ID
                        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY') // Your AWS secret access key
                    },
                };
                return kmsProviders;

            case "azure":
                kmsProviders = {
                    azure: {
                        tenantId: process.env.AZURE_TENANT_ID, // Your Azure tenant ID
                        clientId: process.env.AZURE_CLIENT_ID, // Your Azure client ID
                        clientSecret: process.env.AZURE_CLIENT_SECRET, // Your Azure client secret
                    },
                };
                return kmsProviders;

            case "gcp":
                kmsProviders = {
                    gcp: {
                        email: process.env.GCP_EMAIL, // Your GCP email
                        privateKey: process.env.GCP_PRIVATE_KEY, // Your GCP private key
                    },
                };
                return kmsProviders;

            case "kmip":
                kmsProviders = {
                    kmip: {
                        endpoint: process.env.KMIP_KMS_ENDPOINT, // Your KMIP KMS endpoint
                    },
                };
                return kmsProviders;

            case "local":
                (function () {
                    if (!existsSync("./customer-master-key.txt")) {
                        try {
                            writeFileSync("customer-master-key.txt", randomBytes(96));
                        } catch (err) {
                            throw new Error(
                                `Unable to write Customer Master Key to file due to the following error: ${err}`
                            );
                        }
                    }
                })();
                try {
                    // WARNING: Do not use a local key file in a production application
                    const localMasterKey = readFileSync("./customer-master-key.txt");

                    if (localMasterKey.length !== 96) {
                        throw new Error(
                            "Expected the customer master key file to be 96 bytes."
                        );
                    }

                    kmsProviders = {
                        local: {
                            key: localMasterKey,
                        },
                    };
                } catch (err) {
                    throw new Error(
                        `Unable to read the Customer Master Key due to the following error: ${err}`
                    );
                }
                return kmsProviders;

            default:
                throw new Error(
                    `Unrecognized value for KMS provider name \"${kmsProviderName}\" encountered while retrieving KMS credentials.`
                );
        }
    }

    getCustomerMasterKeyCredentials(kmsProviderName: string): CMKCredentials | {} {
        let customerMasterKeyCredentials: CMKCredentials | {} = {};
        switch (kmsProviderName) {
            case "aws":
                customerMasterKeyCredentials = {
                    key: process.env.AWS_KEY_ARN, // Your AWS Key ARN
                    region: process.env.AWS_KEY_REGION, // Your AWS Key Region
                };
                return customerMasterKeyCredentials;

            case "azure":
                customerMasterKeyCredentials = {
                    keyVaultEndpoint: process.env.AZURE_KEY_VAULT_ENDPOINT, // Your Azure Key Vault Endpoint
                    keyName: process.env.AZURE_KEY_NAME, // Your Azure Key Name
                };
                return customerMasterKeyCredentials;

            case "gcp":
                customerMasterKeyCredentials = {
                    projectId: process.env.GCP_PROJECT_ID, // Your GCP Project ID
                    location: process.env.GCP_LOCATION, // Your GCP Key Location
                    keyRing: process.env.GCP_KEY_RING, //  Your GCP Key Ring
                    keyName: process.env.GCP_KEY_NAME, // Your GCP Key Name
                };
                return customerMasterKeyCredentials;

            case "kmip":
            case "local":
                customerMasterKeyCredentials = {};
                return customerMasterKeyCredentials;

            default:
                throw new Error(
                    `Unrecognized value for KMS provider name \"${kmsProviderName}\" encountered while retrieving Customer Master Key credentials.`
                );
        }
    }

    getAutoEncryptionOptions(kmsProviderName: string,
        keyVaultNamespace: string,
        kmsProviders?: KMSProviders): AutoEncryptionOptions {
        if (kmsProviderName === "kmip") {
            const tlsOptions = this.getKmipTlsOptions();
            const extraOptions = {
                cryptSharedLibPath:  this.configService.get<string>("CRYPTED_SHARED_LIB_PATH") // Path to your Automatic Encryption Shared Library
            };

            const autoEncryptionOptions: AutoEncryptionOptions = {
                keyVaultNamespace,
                kmsProviders,
                extraOptions,
                tlsOptions,
            };
            return autoEncryptionOptions;
        } else {
            const extraOptions = {
                cryptSharedLibPath: this.configService.get<string>("CRYPTED_SHARED_LIB_PATH") // Path to your Automatic Encryption Shared Library
            };

            const autoEncryptionOptions = {
                keyVaultNamespace,
                kmsProviders,
                extraOptions,
            };

            return autoEncryptionOptions;
        }
    }

    getKmipTlsOptions() {
        const tlsOptions = {
            kmip: {
                tlsCAFile: process.env.KMIP_TLS_CA_FILE, // Path to your TLS CA file
                tlsCertificateKeyFile: process.env.KMIP_TLS_CERT_FILE, // Path to your TLS certificate key file
            },
        };
        return tlsOptions;
    }

    async dropExistingCollection(client: MongoClient, databaseName: string): Promise<void> {
        const database = client.db(databaseName);
        await database.dropDatabase()
    }

    getClientEncryption(encryptedClient: MongoClient,
        autoEncryptionOptions) {
        return new ClientEncryption(
            encryptedClient,
            autoEncryptionOptions
        );
    }

    async createEncryptedCollection(clientEncryption,
        encryptedDatabase,
        encryptedCollectionName,
        kmsProviderName,
        encryptedFieldsMap,
        customerMasterKeyCredentials) {
        try {
            // start-create-encrypted-collection
            const result = await clientEncryption.createEncryptedCollection(
                encryptedDatabase,
                encryptedCollectionName,
                {
                    provider: kmsProviderName,
                    createCollectionOptions: encryptedFieldsMap,
                    masterKey: customerMasterKeyCredentials,
                }
            );

            console.log({ result })
            // end-create-encrypted-collection
        } catch (err) {
           return new InternalServerErrorException( `Unable to create encrypted collection due to the following error: ${err}`)
        }
    }

}
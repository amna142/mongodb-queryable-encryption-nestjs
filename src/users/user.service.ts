import { Injectable, InternalServerErrorException, OnModuleInit } from "@nestjs/common";
import { MongoClient } from "mongodb";
import { ConfigService } from "@nestjs/config";
import { EncryptionHelper } from "./encryption.helper";
import { CMKCredentials } from "./interfaces/cmk.interface";
import { KMSProviders } from "./interfaces/kms.interface";


@Injectable()
export class UserService implements OnModuleInit {

    // start-setup-application-variables
    private readonly kmsProviderName: string = 'aws';   // KMS provider name should be one of the following: "aws", "gcp", "azure", "kmip" or "local"
    private encryptedMongoClient: MongoClient;
    private readonly URI: string = '';
    private readonly encryptedDatabaseName: string = '';
    private readonly encryptedCollectionName: string = '';
    private readonly keyVaultDatabaseName: string = '';
    private readonly keyVaultCollectionName: string = '';
    private autoEncryptionOptions: any;


    constructor(
        private configService: ConfigService,
        private qeHelper: EncryptionHelper) {

        this.URI = this.configService.get<string>('MONGODB_URI');
        this.encryptedDatabaseName = this.configService.get<string>("encryptedDatabaseName");
        this.encryptedCollectionName = this.configService.get<string>("encryptedCollectionName");
        this.keyVaultDatabaseName = this.configService.get<string>("keyVaultDatabaseName");
        this.keyVaultCollectionName = this.configService.get<string>("keyVaultCollectionName");
    }

    onModuleInit() {
        const keyVaultNamespace = `${this.keyVaultDatabaseName}.${this.keyVaultCollectionName}`;
        const kmsProviderCredentials: KMSProviders = this.qeHelper.getKMSProviderCredentials(this.kmsProviderName);
        this.autoEncryptionOptions = this.qeHelper.getAutoEncryptionOptions(
            this.kmsProviderName,
            keyVaultNamespace,
            kmsProviderCredentials
        );

        this.encryptedMongoClient = new MongoClient(this.URI, {
            autoEncryption: this.autoEncryptionOptions,
        });
    }

    async create(dto: any) {
        try {
            const customerMasterKeyCredentials: CMKCredentials | {} = this.qeHelper.getCustomerMasterKeyCredentials(this.kmsProviderName);

            await this.qeHelper.dropExistingCollection(this.encryptedMongoClient, this.encryptedDatabaseName);
            await this.qeHelper.dropExistingCollection(this.encryptedMongoClient, this.keyVaultDatabaseName);


            const encryptedFieldsMap = this.fieldMapper();
            const clientEncryption = this.qeHelper.getClientEncryption(
                this.encryptedMongoClient,
                this.autoEncryptionOptions
            );

            await this.qeHelper.createEncryptedCollection(
                clientEncryption,
                this.encryptedMongoClient.db(this.encryptedDatabaseName),
                this.encryptedCollectionName,
                this.kmsProviderName,
                encryptedFieldsMap,
                customerMasterKeyCredentials
            );

            return await this.insertPatient(dto);

        } catch (err) {
            console.log("error in creation of keys -----", err);
            return new InternalServerErrorException(err)
        } finally {
            await this.encryptedMongoClient.close()
        }
    }

    async insertPatient(dto) {
        const encryptedCollection = this.encryptedMongoClient
            .db(this.encryptedDatabaseName)
            .collection(this.encryptedCollectionName);

        const result = await encryptedCollection.insertOne(dto);
        if (!result.acknowledged) return;

        console.log("Successfully inserted the patient document.");

        return {
            status: 200,
            data: result
        }
    }

    async fieldMapper() {
        return {
            encryptedFields: {
                fields: [
                    {
                        path: "age",
                        bsonType: "int",
                        queries: { queryType: "equality" },
                    },
                    {
                        path: "patientRecord.ssn",
                        bsonType: "string",
                        queries: { queryType: "equality" },
                    },
                    {
                        path: "patientRecord.billing",
                        bsonType: "object",
                    },
                ],
            },
        };
    }

    async find(id: string): Promise<any> {
        const encryptedCollection = this.getEncryptedCollection();
        return await encryptedCollection.findOne({
            "age": 29,
        });
    }

    getEncryptedCollection(){
        return this.encryptedMongoClient
        .db(this.encryptedDatabaseName)
        .collection(this.encryptedCollectionName);
    }
}
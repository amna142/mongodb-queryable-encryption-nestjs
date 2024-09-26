
interface AWSCMKCreds {
    aws: {
        key:string,
        region: string
    };
}

interface AzureCMKCreds {
    azure: {
        keyVaultEndpoint: string,
        keyName: string
    }
}

interface GcpCMKCreds {
    gcp: {
        projectId:string,
        location:string,
        keyRing: string,
        keyName: string
    }
}

// Union type for KMS Providers
type CMKCredentials = AWSCMKCreds | AzureCMKCreds | GcpCMKCreds;

// Export if needed in other parts of your application
export { CMKCredentials, AWSCMKCreds, AzureCMKCreds, GcpCMKCreds };

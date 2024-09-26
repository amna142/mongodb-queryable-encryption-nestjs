
interface KMSProviders {
    aws?: {
        accessKeyId: string; 
        secretAccessKey: string; 
    },
    local?: {
        key: Buffer; // Local key should be a Buffer since it's read from a file
    },
    azure?: {
        tenantId: string, 
        clientId: string, 
        clientSecret: string 
    },
    gcp?: {
        email: string;
        privateKey: string
    },
    kmip?: {
        endpoint: string
    }
}

// Export if needed in other parts of your application
export { KMSProviders };

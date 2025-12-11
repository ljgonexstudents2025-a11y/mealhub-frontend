const { app } = require('@azure/functions');
const { BlobServiceClient } = require('@azure/storage-blob');

function slugify(text) {
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

app.http('uploadImage', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('uploadImage function triggered');

        try {
            const formData = await request.formData();
            const file = formData.get('image');
            const mealName = formData.get('mealName');
            
            if (!file || !mealName) {
                return {
                    status: 400,
                    jsonBody: { error: 'Missing image file or meal name' }
                };
            }

            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            const containerName = process.env.BLOB_CONTAINER || 'mealimages';
            
            const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
            const containerClient = blobServiceClient.getContainerClient(containerName);
            
            // Generate unique blob name using slugified meal name + timestamp
            const timestamp = Date.now();
            const extension = file.name.split('.').pop();
            const blobName = `${slugify(mealName)}-${timestamp}.${extension}`;
            
            const blockBlobClient = containerClient.getBlockBlobClient(blobName);
            
            // Convert file to buffer
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            
            // Upload to blob storage
            await blockBlobClient.uploadData(buffer, {
                blobHTTPHeaders: {
                    blobContentType: file.type
                }
            });
            
            const blobUrl = blockBlobClient.url;

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: { 
                    success: true,
                    blobName: blobName,
                    blobUrl: blobUrl
                }
            };

        } catch (error) {
            context.log('Error:', error);
            return {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: { error: error.message }
            };
        }
    }
});

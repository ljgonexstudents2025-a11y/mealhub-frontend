const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');
const { BlobServiceClient } = require('@azure/storage-blob');

function slugify(text) {
    return String(text)
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

app.http('addMeal', {
    methods: ['POST'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('addMeal function triggered');

        try {
            const body = await request.json();
            
            const { restaurant, name, description, prep, price, area } = body;
            
            if (!restaurant || !name || !prep || !price || !area) {
                return {
                    status: 400,
                    jsonBody: { error: 'Missing required fields: restaurant, name, prep, price, area' }
                };
            }

            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            const tableName = process.env.TABLE_MEALS || 'meals1';
            
            const tableClient = TableClient.fromConnectionString(connectionString, tableName);
            
            const entity = {
                PartitionKey: area,
                RowKey: slugify(name),
                restaurantRowKey: restaurant,
                dishName: name,
                description: description || '',
                prepMinutes: parseInt(prep),
                price: parseFloat(price),
            };

            try {
                // Try to insert or update (upsert)
                await tableClient.upsertEntity(entity, 'Replace');
                
                return {
                    status: 200,
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    jsonBody: { 
                        success: true, 
                        message: 'Meal saved successfully',
                        entity: entity
                    }
                };
            } catch (tableError) {
                context.log('Table operation error:', tableError);
                throw tableError;
            }

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

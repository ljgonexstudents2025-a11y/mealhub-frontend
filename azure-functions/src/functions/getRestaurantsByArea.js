const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');

app.http('getRestaurantsByArea', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('getRestaurantsByArea function triggered');

        try {
            const area = request.query.get('area');
            
            if (!area) {
                return {
                    status: 400,
                    jsonBody: { error: 'Area parameter is required' }
                };
            }

            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            const tableName = process.env.TABLE_RESTAURANTS || 'Restaurants';
            
            const tableClient = TableClient.fromConnectionString(connectionString, tableName);
            
            // Query restaurants by PartitionKey (area)
            const restaurants = [];
            const entities = tableClient.listEntities({
                queryOptions: { filter: `PartitionKey eq '${area}'` }
            });

            for await (const entity of entities) {
                restaurants.push({
                    PartitionKey: entity.partitionKey,
                    RowKey: entity.rowKey,
                    logoUrl: entity.ImageUrl || null,
                });
            }

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: restaurants
            };

        } catch (error) {
            context.log('Error:', error);
            return {
                status: 500,
                jsonBody: { error: error.message }
            };
        }
    }
});

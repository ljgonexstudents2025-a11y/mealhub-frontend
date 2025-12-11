const { app } = require('@azure/functions');
const { TableClient } = require('@azure/data-tables');

app.http('getMealsByArea', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (request, context) => {
        context.log('getMealsByArea function triggered');

        try {
            const area = request.query.get('area');
            
            if (!area) {
                return {
                    status: 400,
                    jsonBody: { error: 'Area parameter is required' }
                };
            }

            const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
            const tableName = process.env.TABLE_MEALS || 'meals1';
            
            const tableClient = TableClient.fromConnectionString(connectionString, tableName);
            
            // Query meals by PartitionKey (area)
            const meals = [];
            const entities = tableClient.listEntities({
                queryOptions: { filter: `PartitionKey eq '${area}'` }
            });

            for await (const entity of entities) {
                meals.push({
                    PartitionKey: entity.partitionKey,
                    RowKey: entity.rowKey,
                    Restaurant: entity.Restaurant,
                    Name: entity.Name,
                    Description: entity.Description || '',
                    PrepMinutes: entity.PrepMinutes,
                    Price: entity.Price,
                    ImageBlobName: entity.ImageBlobName || null,
                    Timestamp: entity.timestamp
                });
            }

            return {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                jsonBody: meals
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

exports.handler = async () => {
    try {
        // Try to reach public internet (should timeout if in VPC)
        const https = require('https');
        
        const response = await new Promise((resolve, reject) => {
            const request = https.get('https://www.google.com', { timeout: 5000 }, (res) => {
                resolve('INTERNET_ACCESSIBLE');
            });
            
            request.on('error', (e) => {
                reject('NO_INTERNET_' + e.code);
            });
            
            request.on('timeout', () => {
                reject('TIMEOUT_NO_INTERNET_ACCESS');
            });
        });
        
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: response,
                vpcStatus: 'WARNING - Lambda can reach internet!'
            })
        };
    } catch (error) {
        return {
            statusCode: 200,
            body: JSON.stringify({
                message: error.toString(),
                vpcStatus: 'SUCCESS - Lambda is isolated in VPC!'
            })
        };
    }
};

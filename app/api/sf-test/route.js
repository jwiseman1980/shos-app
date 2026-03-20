import { sfQuery, authenticate } from '@/lib/salesforce';

export async function GET() {
  try {
    // Test authentication
    const auth = await authenticate();

    // Count heroes
    const countResult = await sfQuery('SELECT COUNT(Id) total FROM Memorial_Bracelet__c');
    const count = countResult[0]?.total || 0;

    // Sample heroes as proof
    const sample = await sfQuery(
      'SELECT Rank__c, First_Name__c, Last_Name__c, Service_Academy_or_Branch__c FROM Memorial_Bracelet__c LIMIT 3'
    );

    return Response.json({
      success: true,
      message: 'Connected to Salesforce via OAuth refresh token.',
      heroCount: count,
      sample: sample.map(h => `${h.Rank__c} ${h.First_Name__c} ${h.Last_Name__c} (${h.Service_Academy_or_Branch__c})`),
      instanceUrl: auth.instanceUrl,
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
    }, { status: 500 });
  }
}


//RecordType = Custom Record Type ID
//RecordID = Custom Record Internal ID
var RecordType = 'customrecord_scg_sf_financial_trans'; //Sample ID
var SearchID = 'customsearch459_2'; //Search ID of your selected records
//Search for the records that you want deleted
var SearchResult = nlapiSearchRecord(RecordType,SearchID,null,null);
//Create a Loop to delete each record
for(var ii=0;ii < SearchResult.length && SearchResult != null ;ii++)
{
    var RecordID = SearchResult[ii].getId();
    nlapiDeleteRecord(RecordType,RecordID);
    nlapiLogExecution(‘DEBUG’,‘Deleted Record ’+RecordType, RecordID); // Log Execution
}
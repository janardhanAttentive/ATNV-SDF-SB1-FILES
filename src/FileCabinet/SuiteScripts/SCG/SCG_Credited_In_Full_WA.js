/**
 * @NApiVersion 2.x
 * @NScriptType WorkflowActionScript
 */
define([ 'N/record', './SCG_SFDC_LB'], function( record, lib) {
    function onAction(scriptContext){
        try {
            var newRecord = scriptContext.newRecord;
            newRecord.setValue({ fieldId: 'custbody_scg_credited_in_full', value: true });
            log.debug({ title: 'Credited In Full', details: newRecord.id });
        }
        catch (ex) {
            lib.errorLog(ex);
        }
    }
    return {
        onAction: onAction
    }
});
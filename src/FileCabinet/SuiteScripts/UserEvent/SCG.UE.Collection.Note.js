/**
 * This UserEvent Handles Operations for the SCG Collection Notes custom record
 *
 * @NModuleScope Public
 * @NApiVersion 2.0
 * @NScriptType usereventscript
 * @author Nick Weeks
 * 
 * Version  Date            Author           Remark
 * 1.00                     Nick Weeks       Initial Release
 * 1.05     28 Oct 2020     Doug Humberd     Updated to get/pass 'type' parameter
 * 
 */
define(['SuiteScripts/Lib/SCG.MD.Collection.Notes'], function (colNotes) {

  function afterSubmit (context) {
      var curRec = context.newRecord;
      var type = context.type;
      log.debug('type', type);
      var invoiceID = curRec.getValue({
        fieldId:'custrecord_scg_cn_transaction'
      })
    colNotes.updateInvoice(invoiceID, curRec, type);
  }
  return {
    afterSubmit: afterSubmit
  }
})
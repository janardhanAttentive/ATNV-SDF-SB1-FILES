/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * 
 * Version  Date            Author           Remark
 * 1.00     29 Oct 2020     Doug Humberd     Updates Collection Note records on Invoices when status is changed
 *                          Doug Humberd     When Invoice Status changes to Paid in Full, close all collection note records.  When changed to Open, open most recent collection note record. 
 * 
 */
define(['N/record', 'N/search', 'N/format'],
/**
 * @param {record} record
 * @param {search} search
 */
function(record, search, format) {
   
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} context
     * @param {Record} context.newRecord - New record
     * @param {string} context.type - Trigger type
     * @param {Form} context.form - Current form
     * @Since 2015.2
     */
    function beforeLoad(context) {

    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} context
     * @param {Record} context.newRecord - New record
     * @param {Record} context.oldRecord - Old record
     * @param {string} context.type - Trigger type
     * @Since 2015.2
     */
    function beforeSubmit(context) {
    	
    	try{
    		scg_uicn_checkIfAppliedToInvoice(context);
    	}catch(e){
    		scg_uicn_logError(e);
    	}

    }

    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} context
     * @param {Record} context.newRecord - New record
     * @param {Record} context.oldRecord - Old record
     * @param {string} context.type - Trigger type
     * @Since 2015.2
     */
    function afterSubmit(context) {
    	
    	try{
    		scg_uicn_updInvoiceCollectionNotes(context);
    	}catch(e){
    		scg_uicn_logError(e);
    	}

    }
    
    
    
    
    function scg_uicn_updInvoiceCollectionNotes(context){
    	
    	log.debug('After Submit Script', 'RUNNING');
    	
    	if (context.type != 'create' && context.type != 'delete' && context.type != 'edit'){
    		return;
    	}
    	
    	var trnRec = context.newRecord;
    	var recType = trnRec.type;
    	log.debug('Record Type', recType);
    	
    	//Get today's date, and reformat
    	var now = new Date();
    	var formattedDate = format.format({
    		value : now,
    		type : 'date'
    	});
    	log.debug('Formatted Date', formattedDate);
    	
    	var newestDate;
    	
    	if (recType == 'customerpayment' || recType == 'creditmemo'){
    		
    		var oldTrnRec = context.oldRecord;
    		log.debug('Old Transaction Record', oldTrnRec);
    		
    		var applyCount = trnRec.getLineCount({
    		    sublistId: 'apply'
    		});

    		for (var i = 0; i < applyCount; i++){
    			
    			var applyType = trnRec.getSublistValue({
    			    sublistId: 'apply',
    			    fieldId: 'trantype',
    			    line: i
    			});
    			log.debug('applyType Line ' + i, applyType);
    			
    			var applyChecked = trnRec.getSublistValue({
    			    sublistId: 'apply',
    			    fieldId: 'apply',
    			    line: i
    			});
    			log.debug('Apply Checkbox Line ' + i, applyChecked);
    			
    			if (oldTrnRec){
    				var applyOrigChecked = oldTrnRec.getSublistValue({
        			    sublistId: 'apply',
        			    fieldId: 'apply',
        			    line: i
        			});
    				log.debug('Original Apply Checkbox', applyOrigChecked);
    			}else{
    				var applyOrigChecked = 'F';
    			}
    			
    			
    			//Only Update if Invoice and if either the Apply checkbox is Checked or Apply checkbox was unchecked (was originally checked)
    			if (applyType == 'CustInvc' && (applyChecked == true || (applyChecked == false && applyOrigChecked == true))){
    				
    				var invId = trnRec.getSublistValue({
        			    sublistId: 'apply',
        			    fieldId: 'internalid',
        			    line: i
        			});
    				log.debug('Apply Checked, Invoice Found', 'Invoice # ' + invId);
    				
    				var invFields = search.lookupFields({
    				    type: search.Type.INVOICE,
    				    id: invId,
    				    columns: ['status']
    				});
    				log.debug('invFields', invFields);
    				
    				var invStatus = '';
    				if (!isEmpty(invFields.status)){
    					invStatus = invFields.status[0].value;
    				}
    				log.debug('Invoice Status', invStatus);
    				
    				
    				if (invStatus == 'paidInFull'){
    					
    					var searchresults = search.create({
    						type:'customrecord_scg_collection_note',
    						columns: ['internalid', 'custrecord_scg_cn_follow_up_done'],
    			            filters: [
    			                ['custrecord_scg_cn_transaction', 'anyof', invId]
    			            ]
    					});
    					
    					var result = searchresults.run();
    			    	
    					var resultRange = result.getRange({
    				        start: 0,
    				        end: 1000
    				    });
    					
    					var resultLength = resultRange.length;
    					log.debug('Result Length', resultLength);
    					
    					if (resultLength > 0){
    						
    						log.debug('Search Results Found', 'SUCCESS');
    						
    						for (var x = 0; x < resultRange.length; x++){
    							
    							var noteId = resultRange[x].getValue({
    					            name: 'internalid'
    					        });
    							log.debug('Collection Note ID for Result ' + x, noteId);
    							
    							var completed = resultRange[x].getValue({
    					            name: 'custrecord_scg_cn_follow_up_done'
    					        });
    							log.debug('Follow Up Completed for Result ' + x, completed);
    							
    							
    							if (completed == false){
    								
    								log.debug('Check Follow Up Completed for:', noteId);
    								
    								record.submitFields({
    								    type: 'customrecord_scg_collection_note',
    								    id: noteId,
    								    values: {
    								        'custrecord_scg_cn_follow_up_done': true
    								    }
    								});
    								
    							}
    							
    							
    						}//End for x loop
    						
    					}
    					
    				}//End if (invStatus == 'paidInFull')
    				
    				
    				
    				if (invStatus == 'open'){
    					
    					var searchresults = search.create({
    						type:'customrecord_scg_collection_note',
    						columns: [
    						          search.createColumn({name: 'internalid'}),
    						          search.createColumn({name: 'custrecord_scg_cn_follow_up_done'}),
    						          search.createColumn({name: 'custrecord_scg_cn_date_created'}),
    						          search.createColumn({name: 'created', sort: search.Sort.DESC})
    						          ],
    			            filters: [
    			                ['custrecord_scg_cn_transaction', 'anyof', invId]
    			            ]
    					});
    					
    					var result = searchresults.run();
    			    	
    					var resultRange = result.getRange({
    				        start: 0,
    				        end: 1000
    				    });
    					
    					var resultLength = resultRange.length;
    					log.debug('Result Length', resultLength);
    					
    					if (resultLength > 0){
    						
    						log.debug('Search Results Found', 'SUCCESS');
    						
    						for (var x = 0; x < resultRange.length; x++){
    							
    							var date = resultRange[x].getValue({
    					            name: 'custrecord_scg_cn_date_created'
    					        });
    							log.debug('Collection Note Date Created for Result ' + x, date);
    							
    							var noteId = resultRange[x].getValue({
    					            name: 'internalid'
    					        });
    							log.debug('Collection Note ID for Result ' + x, noteId);
    							
    							var completed = resultRange[x].getValue({
    					            name: 'custrecord_scg_cn_follow_up_done'
    					        });
    							log.debug('Follow Up Completed for Result ' + x, completed);
    							
    							
    							if (x == 0){
    								newestDate = date;
    								log.debug('Newest Date', newestDate);
    							}
    						
    							if (date == newestDate){
    								
    								log.debug('Newest Date: ' + date, 'Open Note if already closed');
    								
    								if (completed == true){
    									
    									log.debug('Uncheck Follow Up Completed for:', noteId);
    									
    									record.submitFields({
        								    type: 'customrecord_scg_collection_note',
        								    id: noteId,
        								    values: {
        								        'custrecord_scg_cn_follow_up_done': false
        								    }
        								});
    									
    								}
    								
    							}
    							
    						}//End for x loop
    						
    					}
    					
    				}//End if (invStatus == 'open')
    				
    			}//End if (applyType == 'CustInvc' && (applyChecked == 'T' || (applyChecked == 'F' && applyOrigChecked == 'T')))
    			
    		}//End for i loop
    		
    	}//End if (recType == 'customerpayment' || recType == 'creditmemo')
    	
    	
    	
    	if (recType == 'journalentry'){
    		
    		var jeId = trnRec.id;
    		log.debug('Journal Entry Id', jeId);
    		
    		var invList = trnRec.getValue({
    		    fieldId: 'custbody_scg_applied_to_invoice'
    		});
    		log.debug('Invoice Array', invList);
    		
    		if (!isEmpty(invList)){
    			
    			var invArray = invList.split(',');
    			
    			for (var z = 0; z < invArray.length; z++){
    				
    				var invId = invArray[z];
    				log.debug('Invoice ID # ' + z, invId);
    				
    				var invFields = search.lookupFields({
    				    type: search.Type.INVOICE,
    				    id: invId,
    				    columns: ['status']
    				});
    				log.debug('invFields', invFields);
    				
    				var invStatus = '';
    				if (!isEmpty(invFields.status)){
    					invStatus = invFields.status[0].value;
    				}
    				log.debug('Invoice Status', invStatus);
    				
    				
    				if (invStatus == 'paidInFull'){
    					
    					var searchresults = search.create({
    						type:'customrecord_scg_collection_note',
    						columns: ['internalid', 'custrecord_scg_cn_follow_up_done'],
    			            filters: [
    			                ['custrecord_scg_cn_transaction', 'anyof', invId]
    			            ]
    					});
    					
    					var result = searchresults.run();
    			    	
    					var resultRange = result.getRange({
    				        start: 0,
    				        end: 1000
    				    });
    					
    					var resultLength = resultRange.length;
    					log.debug('Result Length', resultLength);
    					
    					if (resultLength > 0){
    						
    						log.debug('Search Results Found', 'SUCCESS');
    						
    						for (var x = 0; x < resultRange.length; x++){
    							
    							var noteId = resultRange[x].getValue({
    					            name: 'internalid'
    					        });
    							log.debug('Collection Note ID for Result ' + x, noteId);
    							
    							var completed = resultRange[x].getValue({
    					            name: 'custrecord_scg_cn_follow_up_done'
    					        });
    							log.debug('Follow Up Completed for Result ' + x, completed);
    							
    							
    							if (completed == false){
    								
    								log.debug('Check Follow Up Completed for:', noteId);
    								
    								record.submitFields({
    								    type: 'customrecord_scg_collection_note',
    								    id: noteId,
    								    values: {
    								        'custrecord_scg_cn_follow_up_done': true
    								    }
    								});
    								
    							}
    							
    							
    						}//End for x loop
    						
    					}
    					
    				}//End if (invStatus == 'paidInFull')
    				
    				
    				
    				if (invStatus == 'open'){
    					
    					var searchresults = search.create({
    						type:'customrecord_scg_collection_note',
    						columns: [
    						          search.createColumn({name: 'internalid'}),
    						          search.createColumn({name: 'custrecord_scg_cn_follow_up_done'}),
    						          search.createColumn({name: 'custrecord_scg_cn_date_created'}),
    						          search.createColumn({name: 'created', sort: search.Sort.DESC})
    						          ],
    			            filters: [
    			                ['custrecord_scg_cn_transaction', 'anyof', invId]
    			            ]
    					});
    					
    					var result = searchresults.run();
    			    	
    					var resultRange = result.getRange({
    				        start: 0,
    				        end: 1000
    				    });
    					
    					var resultLength = resultRange.length;
    					log.debug('Result Length', resultLength);
    					
    					if (resultLength > 0){
    						
    						for (var x = 0; x < resultRange.length; x++){
    							
    							var date = resultRange[x].getValue({
    					            name: 'custrecord_scg_cn_date_created'
    					        });
    							log.debug('Collection Note Date Created for Result ' + x, date);
    							
    							var noteId = resultRange[x].getValue({
    					            name: 'internalid'
    					        });
    							log.debug('Collection Note ID for Result ' + x, noteId);
    							
    							var completed = resultRange[x].getValue({
    					            name: 'custrecord_scg_cn_follow_up_done'
    					        });
    							log.debug('Follow Up Completed for Result ' + x, completed);
    							
    							
    							if (x == 0){
    								newestDate = date;
    								log.debug('Newest Date', newestDate);
    							}
    							
    						
    							if (date == newestDate){
    								
    								log.debug('Newest Date: ' + date, 'Open Note if already closed');
    								
    								if (completed == true){
    									
    									log.debug('Uncheck Follow Up Completed for:', noteId);
    									
    									record.submitFields({
        								    type: 'customrecord_scg_collection_note',
        								    id: noteId,
        								    values: {
        								        'custrecord_scg_cn_follow_up_done': false
        								    }
        								});
    									
    								}
    								
    							}//End if (date == newestDate)
    							
    						}//End for x loop
    						
    					}
    					
    				}//End if (invStatus == 'open')
    				
    			}//End for z loop
    			
    		}//End if (!isEmpty(invList))
    		
    		
    		record.submitFields({
			    type: 'journalentry',
			    id: jeId,
			    values: {
			        'custbody_scg_applied_to_invoice': null
			    }
			});
    		
    		
    	}//End if (recType == 'journalentry')
    	
    	
    }
    
    
    
    
    function scg_uicn_checkIfAppliedToInvoice(context){
    	
    	var transRec = context.newRecord;
    	var recType = transRec.type;
    	log.debug('Record Type', recType);
    	
    	//Run for JE's only
    	if (recType != 'journalentry'){
    		return;
    	}
    	
    	//Run on edit and delete
    	if (context.type != 'delete' && context.type != 'edit'){
    		return;
    	}
    	
    	log.debug('Run Type', context.type);
    	
    	var jeId = transRec.id;
    	log.debug('Journal Entry Id', jeId);
    	
    	var invFound = 'N';
    	var invArray = '';
    	var seperator = ',';
    	

    	var searchresults = search.create({
			type:'journalentry',
			columns: ['internalid', 'appliedtotransaction'],
            filters: [
                ['internalid', 'anyof', jeId]
            ]
		});
		
		var result = searchresults.run();
    	
		var resultRange = result.getRange({
	        start: 0,
	        end: 1000
	    });
		
		var resultLength = resultRange.length;
		log.debug('Result Length', resultLength);
		
		if (resultLength > 0){
			
			log.debug('Search Results Found', 'SUCCESS');
			
			for (var i = 0; i < resultRange.length; i++){
				
				var appliedToTransaction = resultRange[i].getValue({
		            name: 'appliedtotransaction'
		        });
				
				var appliedToTransactionText = resultRange[i].getText({
		            name: 'appliedtotransaction'
		        });
				
				log.debug('Applied to Transaction line ' + i, appliedToTransaction);
				log.debug('Applied to Trans Text line ' + i, appliedToTransactionText);
				
				
				if (appliedToTransactionText.indexOf('Invoice') != -1){
    				invFound = 'Y';
    				var invId = appliedToTransaction;
    				
    				if (invArray == ''){
    					invArray = invId;
    				}else{
    					invArray = invArray + seperator + invId;
    				}
    				
    			}
				
				
			}//End for i loop
			
			log.debug('invFound', invFound);
			
			
			if (invFound == 'Y'){
				
				transRec.setValue({
				    fieldId: 'custbody_scg_applied_to_invoice',
				    value: invArray,
				    ignoreFieldChange: true
				});
	    		
	    	}//End if invFound = Y
			
			
		}

		
    }
    
    
    
    
    function isEmpty(stValue)
    { 
        if ((stValue == '') || (stValue == null) ||(stValue == undefined))
        {
            return true;
        }
        
        return false;
    }  

    
    

    return {
        //beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    };
    
});





/**
 * Logs an exception to the script execution log
 * 
 * @appliedtorecord creditmemo, customerpayment, journalentry
 * 
 * @param {String} e Exception
 * @returns {Void}
 */
function scg_uicn_logError(e) {
	// Log the error based on available details
	if (e instanceof nlobjError) {
		log.error('System Error', e.getCode() + '\n' + e.getDetails());
		//alert(e.getCode() + '\n' + e.getDetails());
	} else {
		log.error('Unexpected Error', e.toString());
		//alert(e.toString());
	}
}




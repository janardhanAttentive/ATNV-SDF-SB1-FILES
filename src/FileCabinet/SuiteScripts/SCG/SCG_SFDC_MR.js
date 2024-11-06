// noinspection SpellCheckingInspection,ES6ConvertVarToLetConst

/**
 * Searches for transactions to be synced with Salesforce that have been
 * created or edited since the last time the process ran and creates or
 * edits the corresponding custom record used for the integration
 *
 * @author Andrew Hadfield - SaaS Consulting Group
 *
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 *
 */
define(['N/search', 'N/record', './SCG_SFDC_LB', 'N/runtime', 'N/format'],

    function(search, record, lib, runtime, format) {
        /**
         * Marks the beginning of the Map/Reduce process and generates input data.
         *
         * @typedef {Object} ObjectRef
         * @property {number} id - Internal ID of the record instance
         * @property {string} type - Record type id
         *
         * @return {Array|Object|Search|RecordRef} inputSummary
         * @since 2015.1
         */
        function getInputData() {
            try {
                var scriptObj = runtime.getCurrentScript();
                var deployment = scriptObj.deploymentId;
                var transactionSearch;
                if (deployment === 'customdeploy_scg_sf_int_queue_mr') {
                    transactionSearch = search.load({ id: 'customsearch_scg_sf_financial_trans' });
                }
                else {
                    var lastStart = getDeploymentLastStartDate(deployment);
                    if (!lastStart)
                        lastStart = 'minutesago40';
					
				var filters = [
						  ["mainline","is","T"], 
						  "AND", 
						  ["customer.custentity_scg_sf_account_id","isnotempty",""], 
						  "AND", 
						  [["type","anyof","CustCred","CustPymt"],"OR",[["type","anyof","CustInvc"],"AND",["custbody_invoice_delivery_date","isnotempty",""]]], 
						  "AND", 
						  ["custbody_scg_sf_date_time","after",lastStart]
					   ]

					/*
                    var filters = [
                        search.createFilter({ name: 'type', operator: search.Operator.ANYOF, values: ['CustInvc', 'CustPymt', 'CustCred'] }),
                        search.createFilter({ name: 'mainline', operator: search.Operator.IS, values: 'T' }),
                        search.createFilter({ name: 'custbody_scg_sf_date_time', operator: search.Operator.AFTER, values: lastStart }),
                        search.createFilter({ name: 'custentity_scg_sf_account_id', join: 'customer', operator: search.Operator.ISNOTEMPTY })
                    ];
					*/
                    var columns = [
                        search.createColumn({ name: 'custbody_scg_sf_fin_tran_custrecord' }),
                        search.createColumn({ name: 'custbody_scg_sf_date_time' })
                    ];
                    transactionSearch = search.create({ type: 'transaction', filters: filters, columns: columns });
                }
                //var searchResultCount = transactionSearch.runPaged().count;log.debug({ title: 'search count', details: searchResultCount });
                return transactionSearch;
            }
            catch (ex) {
                errorLog(ex);
            }
        }

        /**
         * Executes when the map entry point is triggered and applies to each key/value pair.
         *
         * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
         * @since 2015.1
         */
        function map(context) {
            try {
                //log.debug({ title: 'context.value', details: context.value });
                var value = JSON.parse(context.value);
                var values = value.values;
                var isCreate = false;
                var finTranId = values.custbody_scg_sf_fin_tran_custrecord.value;
                //var sfTimeStamp = values.custbody_scg_sf_date_time;log.debug({ title: 'sfTimeStamp', details: sfTimeStamp });
                if (context.isRestarted) {
                    var lookupObj = search.lookupFields({ type: value.recordType, id: value.id, columns: 'custbody_scg_sf_fin_tran_custrecord' });
                    finTranId = lookupObj.custbody_scg_sf_fin_tran_custrecord;
                    log.debug({ title: 'finTranId isRestarted', details: finTranId });
                }
                //log.debug({ title: 'finTranId', details: finTranId });
                if (!finTranId)
                    isCreate = true;
                var params = {
                    id : value.id,
                    type : value.recordType,
                    isCreate : isCreate
                };
                finTranId = lib.processFinTran(params);
                log.debug({ title: 'finTranId', details: finTranId });
            }
            catch (ex) {
                errorLog(ex);
            }
        }

        /**
         * Executes when the reduce entry point is triggered and applies to each group.
         *
         * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
         * @since 2015.1
         */
        function reduce(context) {
            try {

            }
            catch (ex) {
                errorLog(ex);
            }
        }
        /**
         * Executes when the summarize entry point is triggered and applies to the result set.
         *
         * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
         * @since 2015.1
         */
        function summarize(summary) {
            try {

            }
            catch (ex) {
                errorLog(ex);
            }
        }
        function getDeploymentLastStartDate(depId) {
            var lastStartDate, returnDate;
            var filters = [
                search.createFilter({ name: 'scriptid', join: 'scriptdeployment', operator: search.Operator.IS, values: depId }),
                search.createFilter({ name: 'mapreducestage', operator: search.Operator.ANYOF, values: 'GET_INPUT' }),
                search.createFilter({ name: 'status', operator: search.Operator.ANYOF, values: 'COMPLETE' })
            ];
            var columns = [
                search.createColumn({ name: 'startdate', summary: search.Summary.MAX })
            ];
            var dateSearch = search.create({ type: record.Type.SCHEDULED_SCRIPT_INSTANCE, filters: filters, columns: columns });
            var result = dateSearch.run().getRange({ start: 0, end: 1 });
            if (result[0]) {
                lastStartDate = result[0].getValue({ name: 'startdate', summary: search.Summary.MAX });
                log.debug({ title: 'lastStartDate before', details: lastStartDate });
                lastStartDate = new Date(lastStartDate);
                lastStartDate = format.format({ value: lastStartDate, type: format.Type.DATETIME});
                lastStartDate = new Date(lastStartDate);

                var month = '' + (lastStartDate.getMonth() + 1),
                    day = '' + lastStartDate.getDate(),
                    year = lastStartDate.getFullYear().toString().substr(-2),
                    hour = lastStartDate.getHours(),
                    minute = lastStartDate.getMinutes(),
                    amPm = 'am';

                if (hour >= 12) {
                    amPm = 'pm';
                    if (hour > 12)
                        hour -= 12;
                }
                if (minute === 0 || minute.toString().length < 2)
                    minute = '0' + minute;

                lastStartDate = [month, day, year].join('/') + ' ' + [hour, minute].join(':') + ' ' + amPm;
                log.debug({ title: 'lastStartDate after', details: lastStartDate });
            }
            return lastStartDate;
        }
        function errorLog(e) {
            var errObj = e;
            if (e instanceof String)
                errObj = JSON.parse(e);
            var errTyp = 'Native JS';
            var errMsg = 'Error: ' + errObj.name + '\n' + 'Message: ' + errObj.message;
            if (errObj.type === 'error.SuiteScriptError') {
                errTyp = 'SuiteScript Error';
                errMsg += '\n' + 'ID: ' + errObj.id + '\n' + 'Stack Trace: ' + errObj.stack;
            }
            else if (errObj.type === 'error.UserEventError') {
                errTyp = 'UserEvent Error';
                errMsg += '\n' + 'Event Type: ' + errObj.eventType + '\n' + 'Record ID: ' + errObj.recordId + '\n' + 'ID: ' + errObj.id + '\n' + 'Stack Trace: ' + errObj.stack;
            }
            log.error({ title: errTyp, details: errMsg });
            return errMsg;
        }
        function getSearchResults(srch) {
            var resultsArray = [];
            var pagedData = srch.runPaged({ pageSize: 1000 });
            var pageCount = pagedData.pageRanges.length;
            var count = pagedData.count;
            if(count === 0)
                return null;
            for (var pageCounter = 0; pageCounter < pageCount; pageCounter++) {
                var page = pagedData.fetch({ 'index': pageCounter });
                var pageDataLength = page.data.length;
                for (var resultCounter = 0; resultCounter < pageDataLength; resultCounter++) {
                    var allValues = page.data[resultCounter].getAllValues();
                    //log.debug('allValues', JSON.stringify(allValues));
                    var valuesObj = {};
                    for (var col in allValues) {
                        var result = allValues[col];
                        if(Array.isArray(result) && result.length !== 0 ) {
                            valuesObj[ col + '_text' ] = result[0].text;
                            valuesObj[col] = result[0].value;
                        }
                        else
                            valuesObj[col] = allValues[col];
                    }
                    resultsArray.push(valuesObj);
                }
            }
            return resultsArray;
        }
        return {
            getInputData: getInputData,
            map: map,
            //reduce: reduce,
            //summarize: summarize
        };
    });

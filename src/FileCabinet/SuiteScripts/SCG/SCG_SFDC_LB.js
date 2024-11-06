/**
 * library file with core logic for updating custom records
 * involved in Financial Transaction sync to Salesforce
 *
 * @author Andrew Hadfield - SaaS Consulting Group
 *
 * @NApiVersion 2.0
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/record', 'N/format', 'N/render', 'N/file'],
function(search, record, format, render, file) {
	function processFinTran(recData) {
		var finRec = record.load({ type: recData.type, id: recData.id });
		var entityId, pdfData, dueDate, amount, customRec, finTranCustomRec, recTypeName;
		var amountRem, creditedInFull = false, setPaidDate = false, mosDate, overrideAmt = false, paidDate = null;
		var paidInFullStatus = 'Paid In Full';
		var dateStamp = getDateTimeTz();
		var currency = finRec.getText('currency');
		var status = finRec.getValue('status');
		var number = finRec.getValue('tranid');
		var date = finRec.getValue('trandate');
		var oppId = finRec.getValue('custbody_scg_sf_opp_id');
		var memo = finRec.getValue('memo');
		if (recData.type === 'invoice') {
			if (recData.isCreate && status === paidInFullStatus) {
				setPaidDate = true;
			}
			pdfData = pdfBase64(recData.id);
			dueDate = finRec.getValue('duedate');
			amountRem = finRec.getValue('amountremaining');
			creditedInFull = finRec.getValue('custbody_scg_credited_in_full');
			mosDate = finRec.getValue('custbody_att_mos_date');
			overrideAmt = finRec.getValue('custbody_att_ovrrd_orig_inv_amt');
		}
		if (recData.type === 'customerpayment') {
			entityId = finRec.getValue('customer');
			amount = finRec.getValue('payment');
		}
		else {
			entityId = finRec.getValue('entity');
			amount = finRec.getValue('total');
		}
		var entityLookup = search.lookupFields({ type: record.Type.CUSTOMER, id: entityId, columns: ['custentity_scg_sf_account_id'] });
		var sfAccountId = entityLookup.custentity_scg_sf_account_id;

		if (sfAccountId) {
			if (recData.isCreate) {
				customRec = record.create({ type: 'customrecord_scg_sf_financial_trans' });
				customRec.setValue('externalid', recData.type + recData.id);
			}
			else {
				finTranCustomRec = finRec.getValue('custbody_scg_sf_fin_tran_custrecord');
				if (!finTranCustomRec) {
					log.debug({ title: 'returning', details: 'no custom record found, was expected'});
					return;
				}
				customRec = record.load({ type: 'customrecord_scg_sf_financial_trans', id: finTranCustomRec});
				if (recData.type === 'invoice') {
					var currStatus = customRec.getValue({ fieldId: 'custrecord_scg_sf_status' });
					if (status === paidInFullStatus && currStatus !== paidInFullStatus) {
						setPaidDate = true;
					}
				}
			}
			if (setPaidDate) {
				paidDate = getPaidInFullDate(recData.id);
			}
			recTypeName = convertTypeName(recData.type);
			customRec.setValue('custrecord_scg_sf_trans', recData.id);
			customRec.setValue('custrecord_scg_sf_currency', currency);
			customRec.setValue('custrecord_scg_sf_amount', amount);
			customRec.setValue('custrecord_scg_sf_status', status);
			customRec.setValue('custrecord_scg_sf_number', number);
			customRec.setValue('custrecord_scg_sf_date', date);
			customRec.setValue('custrecord_scg_sf_entity', sfAccountId);
			customRec.setValue('custrecord_scg_sf_memo', memo);
			customRec.setValue('custrecord_scg_sf_timestamp', dateStamp);
			customRec.setValue('custrecord_scg_sf_type', recTypeName);
			customRec.setValue('custrecord_scg_sf_credited_in_full', creditedInFull);
			customRec.setValue('custrecord_scg_sf_override_amount', overrideAmt);
            customRec.setValue('custrecord_att_intergation_status', 1);
			if (oppId)
				customRec.setValue('custrecord_scg_sf_opp', oppId);
			if (pdfData)
				customRec.setValue('custrecord_scg_sf_file_contents', pdfData);
			if (dueDate)
				customRec.setValue('custrecord_scg_sf_due_date', dueDate);
			if (amountRem)
				customRec.setValue('custrecord_scg_sf_amount_remaining', amountRem);
			else if (recData.type === 'invoice')
				customRec.setValue('custrecord_scg_sf_amount_remaining', 0);
			if (mosDate)
				customRec.setValue('custrecord_scg_sf_mos_date', mosDate);
			else
				customRec.setValue('custrecord_scg_sf_mos_date', null);
			if (paidDate)
				customRec.setValue('custrecord_scg_sf_fully_paid_date', paidDate);


			var customRecId = customRec.save();
			if (recData.isCreate) {
				var recId = record.submitFields({ type: recData.type, id: recData.id, values: { custbody_scg_sf_fin_tran_custrecord: customRecId }});
				log.debug({ title: 'record updated', details: recData.type + ', ' + recId });
			}
			if (setPaidDate) {
				var recId = record.submitFields({ type: recData.type, id: recData.id, values: { custbody_scg_sf_paid_date: paidDate }});
				log.debug({ title: 'setPaidDate updated', details: recData.type + ', ' + recId });
			}
			return customRecId;
		}
	}
	function getPaidInFullDate(invoiceId) {
		var value = null;
		var filters = [
			search.createFilter({ name: 'type', operator: search.Operator.ANYOF, values: 'CustInvc' }),
			search.createFilter({ name: 'mainline', operator: search.Operator.IS, values: 'T' }),
			search.createFilter({ name: 'taxline', operator: search.Operator.IS, values: 'F' }),
			search.createFilter({ name: 'amountremaining', operator: search.Operator.IS, values: '0.00' }),
			search.createFilter({ name: 'internalid', operator: search.Operator.ANYOF, values: invoiceId })
		];
		var columns = [
			search.createColumn({name: 'internalid', summary: 'GROUP'}),
			search.createColumn({name: 'trandate', join: 'applyingtransaction', summary: 'MAX'})
		];
		var paidDateSearch = search.create({ type: search.Type.TRANSACTION, filters: filters, columns: columns });
		var result = paidDateSearch.run().getRange({ start: 0, end: 1 });
		if (result[0]) {
			var applyDate = result[0].getValue({ name: 'trandate', join: 'applyingtransaction', summary: search.Summary.MAX });
			if (applyDate) {
				value = format.parse({ value: applyDate, type: format.Type.DATE });
			}
		}
		return value;
	}
	function getFxOverdueBalance(customerId) {
		var value = 0;
		var filters = [
			search.createFilter({ name: 'type', operator: search.Operator.ANYOF, values: 'CustInvc' }),
			search.createFilter({ name: 'mainline', operator: search.Operator.IS, values: 'T' }),
			search.createFilter({ name: 'status', operator: search.Operator.ANYOF, values: 'CustInvc:A' }),
			search.createFilter({ name: 'amountremaining', operator: search.Operator.GREATERTHAN, values: '0.00' }),
			search.createFilter({ name: 'daysoverdue', operator: search.Operator.GREATERTHAN, values: '0' }),
			search.createFilter({ name: 'custentity_scg_sf_account_id', join: 'customer', operator: search.Operator.ISNOTEMPTY }),
			search.createFilter({ name: 'internalid', join: 'customer', operator: search.Operator.ANYOF, values: customerId })
		];
		var columns = [
			search.createColumn({name: "custentity_scg_sf_account_id", join: "customer", summary: "GROUP"}),
			search.createColumn({name: "fxamountremaining", summary: "SUM"})
		];
		var overdueSearch = search.create({ type: search.Type.TRANSACTION, filters: filters, columns: columns });
		var result = overdueSearch.run().getRange({ start: 0, end: 1 });
		if (result[0]) {
			value = result[0].getValue({name: "fxamountremaining", summary: search.Summary.SUM});
			//log.debug({ title: 'overdue value', details: value });
		}
		return value;
	}
	function getFxTotalInvoiced(customerId) {
		var value = 0;
		var filters = [
			search.createFilter({ name: 'type', operator: search.Operator.ANYOF, values: 'CustInvc' }),
			search.createFilter({ name: 'mainline', operator: search.Operator.IS, values: 'T' }),
			search.createFilter({ name: 'status', operator: search.Operator.NONEOF, values: ['CustInvc:E', 'CustInvc:V'] }),
			search.createFilter({ name: 'amount', operator: search.Operator.GREATERTHAN, values: '0.00' }),
			search.createFilter({ name: 'custentity_scg_sf_account_id', join: 'customer', operator: search.Operator.ISNOTEMPTY }),
			search.createFilter({ name: 'internalid', join: 'customer', operator: search.Operator.ANYOF, values: customerId })
		];
		var columns = [
			search.createColumn({name: "custentity_scg_sf_account_id", join: "customer", summary: "GROUP"}),
			search.createColumn({name: "fxamount", summary: "SUM"})
		];
		var invoiceSearch = search.create({ type: search.Type.TRANSACTION, filters: filters, columns: columns });
		var result = invoiceSearch.run().getRange({ start: 0, end: 1 });
		if (result[0]) {
			value = result[0].getValue({name: "fxamount", summary: search.Summary.SUM});
			//log.debug({ title: 'total invoiced value', details: value });
		}
		return value;
	}
	function getFxTotalCredits(customerId) {
		var value = 0;
		var filters = [
			search.createFilter({ name: 'type', operator: search.Operator.ANYOF, values: 'CustCred' }),
			search.createFilter({ name: 'mainline', operator: search.Operator.IS, values: 'T' }),
			search.createFilter({ name: 'status', operator: search.Operator.NONEOF, values: ['CustCred:V'] }),
			search.createFilter({ name: 'amount', operator: search.Operator.GREATERTHAN, values: '0.00' }),
			search.createFilter({ name: 'custentity_scg_sf_account_id', join: 'customer', operator: search.Operator.ISNOTEMPTY }),
			search.createFilter({ name: 'internalid', join: 'customer', operator: search.Operator.ANYOF, values: customerId })
		];
		var columns = [
			search.createColumn({name: "custentity_scg_sf_account_id", join: "customer", summary: "GROUP"}),
			search.createColumn({name: "fxamount", summary: "SUM"})
		];
		var creditMemoSearch = search.create({ type: search.Type.TRANSACTION, filters: filters, columns: columns });
		var result = creditMemoSearch.run().getRange({ start: 0, end: 1 });
		if (result[0]) {
			value = result[0].getValue({name: "fxamount", summary: search.Summary.SUM});
			//log.debug({ title: 'total credits value', details: value });
		}
		return value;
	}
	function getFxTotalPaid(customerId) {
		var value = 0;
		var filters = [
			search.createFilter({ name: 'type', operator: search.Operator.ANYOF, values: 'CustPymt' }),
			search.createFilter({ name: 'mainline', operator: search.Operator.IS, values: 'T' }),
			search.createFilter({ name: 'status', operator: search.Operator.NONEOF, values: ['CustPymt:R'] }),
			search.createFilter({ name: 'amount', operator: search.Operator.GREATERTHAN, values: '0.00' }),
			search.createFilter({ name: 'custentity_scg_sf_account_id', join: 'customer', operator: search.Operator.ISNOTEMPTY }),
			search.createFilter({ name: 'internalid', join: 'customer', operator: search.Operator.ANYOF, values: customerId })
		];
		var columns = [
			search.createColumn({name: "custentity_scg_sf_account_id", join: "customer", summary: "GROUP"}),
			search.createColumn({name: "fxamount", summary: "SUM"})
		];
		var paymentSearch = search.create({ type: search.Type.TRANSACTION, filters: filters, columns: columns });
		var result = paymentSearch.run().getRange({ start: 0, end: 1 });
		if (result[0]) {
			value = result[0].getValue({name: "fxamount", summary: search.Summary.SUM});
			//log.debug({ title: 'total credits value', details: value });
		}
		return value;
	}
	function convertTypeName(nsType) {
		var typeStr;
		switch (nsType) {
			case 'invoice': typeStr = 'Invoice'; break;
			case 'customerpayment': typeStr = 'Payment'; break;
			case 'creditmemo': typeStr = 'Credit Memo'; break;
		}
		return typeStr;
	}
	function pdfBase64(tranId) {
		var pdfFile = render.transaction({ entityId: Number(tranId), printMode: render.PrintMode.PDF });
		var pdfString = pdfFile.getContents();
		return pdfString;
	}
	function getDateTimeTz() {
		var date = new Date();
		var dateTimeStr = format.format({ value: date, type: format.Type.DATETIMETZ });
		var dateTimeRaw = format.parse({ value: dateTimeStr, type: format.Type.DATETIMETZ });
		return dateTimeRaw;
	}
	function getDateNow() {
		var date = new Date();
		var dateNowStr = format.format({ value: date, type: format.Type.DATE });
		var dateNowRaw = format.parse({ value: dateNowStr, type: format.Type.DATE });
		return dateNowRaw;
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
		log.error({title: errTyp, details: errMsg});
		return errMsg;
	}
	function getSearchResults(srch) {
		try {
			var resultsArray = [];
			var pagedData = srch.runPaged({ pageSize: 1000 });
			var pageCount = pagedData.pageRanges.length;
			var count = pagedData.count; 
			if(count === 0) {
				return null;
			}
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
						else {
							valuesObj[col] = allValues[col];
						}
					}
					resultsArray.push(valuesObj);
				}
			}
			return resultsArray;
		}
		catch (ex) {
			errorLog(ex); 
		}
	}
    return {
    	errorLog: errorLog,
    	getSearchResults: getSearchResults,
    	getDateTimeTz: getDateTimeTz,
		getDateNow: getDateNow,
    	pdfBase64: pdfBase64,
		getFxOverdueBalance: getFxOverdueBalance,
		getFxTotalInvoiced: getFxTotalInvoiced,
		getFxTotalCredits: getFxTotalCredits,
		getFxTotalPaid: getFxTotalPaid,
		processFinTran: processFinTran
	};
});

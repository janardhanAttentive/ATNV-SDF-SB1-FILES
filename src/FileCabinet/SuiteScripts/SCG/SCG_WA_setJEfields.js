/**
 * @NApiVersion 2.1
 * @NScriptType WorkflowActionScript
 */
define(['N/record', 'N/runtime', "N/redirect"],
    
    (record, runtime, redirect) => {
        /**
         * Defines the WorkflowAction script trigger point.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.workflowId - Internal ID of workflow which triggered this action
         * @param {string} scriptContext.type - Event type
         * @param {Form} scriptContext.form - Current form that the script uses to interact with the record
         * @since 2016.1
         */
        const onAction = (scriptContext) => {
            const recordObj = scriptContext.newRecord;
            let recId = recordObj.id;
            let roleField = recordObj.getValue('custbody_scg_creator_role');
            let userField = recordObj.getValue('custbody_scg_created_by');
            log.debug('record type', recordObj.type);
            if (recordObj.type === record.Type.INTER_COMPANY_JOURNAL_ENTRY){
                return;
            }
            if (isEmpty(roleField) || isEmpty(userField)){
                let rec = record.load({
                    type: recordObj.type,
                    id: recId
                });
                record.Type.STATISTICAL_JOURNAL_ENTRY
                const user = runtime.getCurrentUser();
                const role = user.role;
                rec.setValue('custbody_scg_creator_role', role);
                rec.setValue('custbody_scg_created_by', user.id);
                rec.save();
                redirect.toRecord({
                    type: record.Type.JOURNAL_ENTRY,
                    id: recId
                });
            }

        }

        const isEmpty = (value) => {
            if(value===''||value===null||value===undefined||value===[]){
                return true;
            }
            return false;
        }

        return {onAction};
    });

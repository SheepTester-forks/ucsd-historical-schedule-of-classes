$(function()
{ // ready
    $("body").fadeIn(100);
    //alert('in start function');

    $.support.cors = true; // FOR IE9

    if (!window.console) console = {
        log : function()
        {}
    }; // for IE

    if (typeof String.prototype.trim !== 'function')
    {
        String.prototype.trim = function()
        {
            return this.replace(/^\s+|\s+$/g, '');
        }
    }

    // TARGETS IE8 AND EARLIER
    if (document.all
        && !document.addEventListener)
    {

        // REJECT IE 7 OR EARLIER
        if (document.all
            && !document.querySelector)
        {
            alert("Your browser is currently not supported by Webreg.  Please update your browser to the current version or use the latest version of Chrome or Firefox for the best experience.");
            window.location.replace("http://students.ucsd.edu");
        }
        else
        {
            // IE8
            $('#ie-message').show(); // display ie 8 warning
        }
    }

    // show spinner while page is loading
    $("body").addClass("wr-spinner-loading");

    // wrappers -------------------------------------------

    function wrapperWrLogger(sectNum, subjCode, crseCode, termCode, action, success, result)
    {
        //alert('in wrapperWrLogger');
        if (success)
        {
            result = "SUCCESS: "
                + result;
        }
        else
        {
            result = "FAIL: "
                + result;
        }

        ajaxExe({
            url : '/webreg2/svc/wradapter/wr-logger', dataType : 'json', type : 'POST', data : {
                "sectnum" : sectNum, "subjcode" : subjCode, "crsecode" : crseCode.trim(), "action" : action, "result" : result, "termcode" : termCode
            }, error : function(data)
            {
                return;
            }
        });
    }

    function wrapperStartPageLogger()
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/wr-logger', dataType : 'json', type : 'POST', data : {
                "sectnum" : '', "subjcode" : 'N/A', "crsecode" : 'N/A', "action" : 'START PAGE', "result" : '', "termcode" : 'N/A'
            }, error : function(data)
            {
                return;
            }
        });
    }

    function wrapperGetTerm(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/get-term', dataType : 'json', type : 'GET', successF : sucFunc
        });
    }

    function wrapperGetStatusStart(termCode, seqId, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/get-status-start', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "termcode" : termCode, "seqid" : seqId
            }, successF : sucFunc
        });
    }

    function wrapperCheckEligibility(termCode, seqId, logged, sucFunc)
    {
        //alert('in wrapperCheckEligibility');
        ajaxExe({
            url : '/webreg2/svc/wradapter/check-eligibility', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "termcode" : termCode, "seqid" : seqId, "logged" : logged
            }, successF : sucFunc
        });
    }

    function wrapperGetMsgToProceed(termCode, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/get-msg-to-proceed', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "termcode" : termCode
            }, successF : sucFunc
        });
    }

    function wrapperGetStatusForLevel(aLevel, seqId, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/get-status-for-level', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "alevel" : aLevel, "seqid" : seqId
            }, successF : sucFunc
        });
    }

    // functions -------------------------------------------
    function ajaxExe(obj)
    {

        var ajaxObj = {
            // required or reference error
            url : obj.url,

            // defaults
            type : 'GET',
            cache : false,
            crossDomain : true,

            error : function(jqXHR, status, jQerr)
            {

                // Service timeout (spring)
                if (jqXHR.status === 0
                    && status == "timeout")
                {
                    displayGeneralErrorMsg("<div class='msg error'><h4>Service Unavailable</h4><span>We're currently experiencing unusually high traffic.  Please try again in a few minutes.</span></div>");
                }
                // session timeout (jlink)
                else if (jqXHR.status === 0
                    || jqXHR.status == 307)
                {
                    window.location.replace("/webreg2/");
                }
                else
                { // other
                    displayGeneralErrorMsg("<div class='msg error'><h4>System Error</h4>Please try again and if the error persists report the problem at servicedesk@ucsd.edu</div>");
                }
                return;
            }

            ,
            success : function(data)
            {

                // if ivory is down
                if ('successF' in obj)
                {
                    if (undefined != data.OPSIV
                        && "FAIL" == data.OPSIV
                        && undefined != data.IVORY_UNAVAIL_MSG)
                    {

                        displayGeneralErrorMsg("<div class='msg error'><h4>Alert:</h4>"
                            + data.IVORY_UNAVAIL_MSG
                            + "</div>");
                    }
                    else
                    {
                        obj.successF(data);
                    }
                }
            }
        };

        // inject if requested
        if ('type' in obj)
        {
            ajaxObj.type = obj.type;
        }
        if ('data' in obj)
        {
            ajaxObj.data = obj.data;
        }
        if ('dataType' in obj)
        {
            ajaxObj.dataType = obj.dataType;
        }
        if ('contentType' in obj)
        {
            ajaxObj.contentType = obj.contentType;
        }
        if ('mimeType' in obj)
        {
            ajaxObj.mimeType = obj.mimeType;
        }
        if ('error' in obj)
        {
            ajaxObj.error = obj.error;
        }
        if ('async' in obj)
        {
            ajaxObj.async = obj.async;
        }
        if ('global' in obj)
        {
            ajaxObj.global = obj.global;
        }
        if ('beforeSend' in obj)
        {
            ajaxObj.beforeSend = obj.beforeSend;
        }

        $.ajax(ajaxObj);
    }

    function displayGeneralErrorMsg(msg)
    {
        if (undefined != msg)
        {
            $("#dialog-msg-small").dialog('open')
            $("#dialog-msg-small-tip").html(msg);
        }
    }

    function displayConfirmDialog(msg)
    {
        if (undefined != msg)
        {
            $("#dialog-confirm").dialog('open')
            $("#dialog-confirm-tip").html(msg);
        }
    }

    function displayPageErrorMsg(msg)
    {
        if (undefined != msg)
        {
            $("#startpage-msgs").empty();
            $("#startpage-msgs").append('<div class="msg error"><h4>Alert: </h4>'
                + msg
                + '</div>');
        }
    }

    $(document).ajaxStart(function()
    {
        $("body").addClass("wr-spinner-loading");
    });

    $(document).ajaxStop(function()
    {
        $("body").removeClass("wr-spinner-loading");
    });

    function goToMain(paramObj)
    {
        var str = $.param(paramObj);
        window.location.replace('/webreg2/main?'
            + str);
    }

    /*
     * Dialog for selecting academic level for students with multiple levels for a term.
     */
    $("#dialog-multi-level").dialog({
        autoOpen : false, maxWidth : 600, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 600, modal : true, closeOnEscape : false, buttons : {

            Cancel : {
                text : "Cancel", click : function()
                {
                    $(this).dialog("close");
                }
            },

            Confirm : {
                text : "Go", click : function()
                {
                    $(this).dialog("close");
                    var aLevel = $('#dialog-multi-level-select option:selected').val();

                    var thisdialog = $(this);
                    var seqId = thisdialog.dialog('option', 'seqId');
                    wrapperGetStatusForLevel(aLevel, seqId, function(data)
                    {

                        if (undefined != data.ERROR_MESSAGE)
                        {
                            displayPageErrorMsg(data.ERROR_MESSAGE);
                        }
                        else
                        {
                            var termCode = thisdialog.dialog('option', 'termCode');
                            checkEligibility(termCode, seqId, aLevel);
                        }
                    });

                    return;

                }
            }
        }
    });

    /*
     * General error message dialog
     */
    $("#dialog-msg-small").dialog({
        autoOpen : false, maxWidth : 600, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 500, modal : true, closeOnEscape : false, buttons : {
            but1 : {
                text : 'Close', id : "dialog-msg-close", click : function()
                {
                    $(this).dialog("close");
                }
            }
        }
    });

    /*
     * Dialog for eligibility warning message.
     */
    $("#dialog-confirm").dialog({
        autoOpen : false, maxWidth : 800, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 800, modal : true, closeOnEscape : false, buttons : {
            but1 : {
                text : 'Disagree', id : "dialog-confirm-cancel", click : function()
                {
                    $(this).dialog("close");
                }
            }, but2 : {
                text : 'Agree', id : "dialog-confirm-confirm", click : function()
                {
                    $(this).dialog("close");
                    var p1 = $(this).dialog('option', 'termCode');
                    var p2 = $(this).dialog('option', 'aLevel');

                    var paramObj = {
                        "p1" : p1, "p2" : p2
                    }
                    goToMain(paramObj);
                }
            }
        }
    });

    /*
     * Setup initial status by term then checks eligibility if single level.
     */
    function getStatusStart(termCode, aLevel, seqId)
    {

        if (aLevel != undefined)
        {
            wrapperGetStatusForLevel(aLevel, seqId, function(data)
            {

                if (undefined != data.ERROR_MESSAGE)
                {
                    displayPageErrorMsg(data.ERROR_MESSAGE);
                }
                else
                {
                    checkEligibility(termCode, seqId, aLevel);
                }
            });
            return;
        }

        wrapperGetStatusStart(termCode, seqId, function(data)
        {

            if (data.length > 1)
            { // multilevel

                var diagObj = $('#dialog-multi-level').dialog('open');
                diagObj.dialog('option', 'termCode', termCode);
                diagObj.dialog('option', 'seqId', seqId);
                var maLevelDiv = $('#dialog-multi-level-div');
                maLevelDiv.empty();
                maLevelDiv.append("<select id='dialog-multi-level-select' style='text-algin:left'></select>");
                var maLevelSelect = $('#dialog-multi-level-select');

                $.each(data, function(index, entry)
                {
                    var text = entry.ACADEMIC_LEVEL;
                    switch (entry.ACADEMIC_LEVEL)
                    {
                        case "UN":
                            text = "Undergraduate";
                            break;
                        case "GR":
                            text = "Graduate";
                            break;
                        case "PH":
                            text = "Doctoral";
                            break;
                        case "MD":
                            text = "Medical";
                            break;
                    }
                    maLevelSelect.append($('<option></option>').val(entry.ACADEMIC_LEVEL).html(text));
                });
                $("#dialog-multi-level-tip").html("<b>Please select an academic level:</b>");
                return;
            }
            else
            {

                if (undefined != data[0].ERROR_MESSAGE)
                {
                    wrapperWrLogger(0, 'N/A', 'N/A', termCode, 'CHECK ELIGIBILITY', false, data[0].ERROR_MESSAGE);
                    displayPageErrorMsg(data[0].ERROR_MESSAGE);
                }
                else
                {
                    var aLevel = data[0].ACADEMIC_LEVEL;
                    checkEligibility(termCode, seqId, aLevel);
                }
            }

        });

    } // getStatusStart

    function checkEligibility(termCode, seqId, aLevel)
    {
        // eligibility
        wrapperCheckEligibility(termCode, seqId, true, function(data)
        {

            if ('SUCCESS' == data.OPS)
            {
                wrapperGetMsgToProceed(termCode, function(data)
                {
                    var msg = data.WARN_MSG;

                    if (undefined != msg
                        && '' != msg.trim())
                    {
                        var diagObj = $("#dialog-confirm").dialog('open')
                        diagObj.dialog('option', 'termCode', termCode);
                        diagObj.dialog('option', 'aLevel', aLevel);
                        displayConfirmDialog("<b>Notice:</b><br><br>"
                            + msg);
                        $('.ui-dialog :button').blur();

                    }
                    else
                    {
                        var paramObj = {
                            "p1" : termCode, "p2" : aLevel
                        }
                        goToMain(paramObj);
                    }
                });

            }
            else
            {
                var msg = "<ul>";
                for (var i = 0; true; i++)
                {

                    var val = data['REASON'
                        + i];
                    if (undefined == val)
                    {
                        break;
                    }

                    msg += "<li>"
                        + val
                        + "</li>";

                }
                msg += "</ul>";
                displayPageErrorMsg(msg);
            }

        });
    }

    /*
     * Parse url params
     */
    function getUrlParam(key)
    {
        var url = window.location.search.substring(1);
        var paramList = url.split('&');
        for (var i = 0; i < paramList.length; i++)
        {
            var oneParam = paramList[i].split('=');
            if (oneParam[0] == key)
            {
                return oneParam[1];
            }
        }
    }

    var termCode = "";
    /*
     * Onclick handling for go button.
     */
    $('#startpage-button-go').button().click(function()
    {
        var selectVal = $("#startpage-select-term").val();
        var selectArr = selectVal.split(":::");
        var seqId = selectArr[0];
        termCode = selectArr[1];
        getStatusStart(termCode, undefined, seqId);
    });

    function getTermDisplay(termCode, termDesc)
    {
        var termLetters = termCode.substring(0, 2);
        var retVal = "";
        switch (termLetters)
        {
            case 'SU':
                retVal = "Summer Med School";
                break;
            case 'S1':
                retVal = "Summer Session I";
                break;
            case 'S2':
                retVal = "Summer Session II";
                break;
            case 'S3':
                retVal = "Special Summer Session";
                break;
            case 'FA':
                retVal = "Fall Quarter";
                break;
            case 'WI':
                retVal = "Winter Quarter";
                break;
            case 'SP':
                retVal = "Spring Quarter";
                break;
            default:
                retVal = "Unknown";
                break;
        }
        var year = termDesc.replace(/\D/g, "");
        return retVal
            + " "
            + year.trim();
    }

    /*******************************************************************************************************************
     * EXECUTION START
     ******************************************************************************************************************/

    // initial load
    wrapperGetTerm(function(data)
    {
        $("#startpage-select-term").empty();
        $.each(data, function(index, entry)
        {
            var termDesc = entry.termDesc;
            var seqId = entry.seqId;
            var termCode = entry.termCode;
            termDesc = getTermDisplay(termCode, termDesc);
            $("<option value='"
                + seqId
                + ":::"
                + termCode
                + "'>"
                + termDesc
                + "</option>").appendTo("#startpage-select-term");

        });
    });

    var urlParam1 = getUrlParam("p1"); // termCode
    var urlParam2 = getUrlParam("p2"); // aLevel
    var urlParam4 = getUrlParam("p4"); // seqId
    if (undefined != urlParam1
        && undefined != urlParam4)
    {
        getStatusStart(urlParam1, urlParam2, urlParam4);
    } // else we stop
    else
    {
        wrapperStartPageLogger();
    }

    // show content and remove spinner after page is loaded
    $('#wr-start-content').css('display', 'block');
    $("body").removeClass("wr-spinner-loading");
});

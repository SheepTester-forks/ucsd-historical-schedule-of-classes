$(function()
{

    $("body").fadeIn(100);

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

    // FOR IE 8
    if (!Array.prototype.indexOf)
    {
        Array.prototype.indexOf = function(val)
        {
            return jQuery.inArray(val, this);
        };
    }

    var isIE8 = false;

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
            isIE8 = true;
        }
    }

    // display spinner while loading page
    $("body").addClass("wr-spinner-loading");

    function signOut()
    {
        window.location.replace("/security/student/logout?url=http://students.ucsd.edu");
    }

    function redirectToTop()
    {
        window.location.replace("/webreg2/");
    }

    // ////////// - session timeout
    var idleTimer;

    $("#dialog-session-timeout").dialog({

        autoOpen : false, maxWidth : 600, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 600, modal : true, closeOnEscape : false, buttons : {
            'No' : redirectToSessionClosedPage, 'Yes' : pingSessionController
        }
    });

    $(this).mousemove(function(e)
    {
        if (idleTimer != undefined)
        {
            window.clearTimeout(idleTimer);
        }
        var eighteenMinutes = 1080000;
        idleTimer = window.setTimeout(warnUser, eighteenMinutes);
    });

    function warnUser()
    {
        window.clearTimeout(idleTimer);
        var twoMinutes = 120000;
        idleTimer = window.setTimeout(redirectToSessionClosedPage, twoMinutes);
        $("#dialog-session-timeout").dialog('open');
    }

    function pingSessionController()
    {
        $("#dialog-session-timeout").dialog('close');
        wrapperPingSessionController(function(data)
        {
            if (data != undefined)
            {
                if (!data.SESSION_OK)
                {
                    redirectToTop();
                }
            }
            else
            {
                redirectToTop();
            }
        });
    }

    function redirectToSessionClosedPage()
    {
        $("#dialog-session-timeout").dialog('close');
        signOut();
    }

    // ///////// - end session timeout

    // glob
    var urlParam1 = getUrlParam("p1"); // termcode
    var urlParam2 = getUrlParam("p2"); // alevel
    var fromOutsideParam = getUrlParam("p3");
    if (urlParam1 != undefined)
    {
        var isSummerSession = urlParam1.match(/^S1|^S2|^S3|^SU/i) ? true : false;
        var isSummerSession3 = (urlParam1.match(/^S3/i)) ? true : false;
    }
    else
    {
        redirectToTop();
    }

    function termCodeToText(termCode)
    {
        var term = termCode.substring(0, 2);
        var str = "";
        switch (term)
        {
            case 'SP':
                str += "Spring Quarter";
                break;
            case 'FA':
                str += "Fall Quarter";
                break;
            case 'WI':
                str += "Winter Quarter";
                break;
            case 'S1':
                str += "Summer Session I";
                break;
            case 'S2':
                str += "Summer Session II";
                break;
            case 'S3':
                str += "Special Summer Session";
                break;
            case 'SU':
                str += "Summer Med School";
                break;
        }
        var year = termCode.substring(2, 4);
        return str
            + " 20"
            + year;
    }
    var termCodeText = termCodeToText(urlParam1);

    var alertFromAppt = false;
    var alertFromFinalSat = false;

    var imgDown = "/webreg2/resources/images/down_arrow.png";
    var imgRight = "/webreg2/resources/images/right_arrow.png";

    // schedule
    var schedDefault = "My Schedule";
    var schedCur = schedDefault;

    // event
    var aeEventArr = [];
    aeEventArr.length = 0;

    // major bottleneck without this
    var checkAndGetGradeUnitObj = {};

    // today
    var today = new Date(); // current date and time
    var today_y = today.getFullYear();
    var today_m = today.getMonth(); // 0-11
    var today_d = today.getDate(); // 1-31
    var today_wd = today.getDay(); // 0-6 Sun-Sat
    var todayGetTime = today.getTime(); // milisec

    var mstr = today_m + 1;
    if (mstr < 10)
    {
        mstr = "0"
            + String(mstr);
    }
    var dstr = today_d;
    if (dstr < 10)
    {
        dstr = "0"
            + dstr;
    }
    var todayStr = today_y
        + "-"
        + mstr
        + "-"
        + dstr;

    // button hover messages
    var notEditableMsg = 'Cannot edit at this time';
    var notDropableMsg = 'Cannot drop at this time';
    var notWaitlistableMsg = 'Cannot waitlist at this time';
    var got56or64Msg = 'Confirm your appointment time or check holds';
    var notEnrollableMsg = 'Cannot enroll at this time';
    var alreadyEnrolledMsg = 'Course already enrolled';
    var gotFtypeMsg = alreadyEnrolledMsg;
    var gotMDMsg = 'Not available for MD';
    var cantPlanMsg = 'Cannot plan at this time.';
    var got64Msg = 'Confirm your appointment time';
    var get56Msg = 'Check your holds';
    var alreadyWaitlistedMsg = 'Course already waitlisted';
    var alreadyEnrolledOrWaitlistedMsg = 'Course already enrolled or waitlisted';
    var preauthEnrollmentMsg = 'Preauthorized enrollment';
    var alreadyPlannedEnrolledWaitlistedMsg = 'Section already planned, enrolled or waitlisted';

    var beginDropAction = "BEGIN DROP";
    var beginDropWaitlistAction = "BEGIN DROP WAITLIST";
    var beginChangeAction = "BEGIN CHANGE";
    var beginChangeWaitlistAction = 'BEGIN CHANGE WAITLIST';

    // titles (to be updated as they're noticed
    var noChangeTitle = 'This class does not allow you to change grade option or units.';

    // conflict
    var conflictArray = [];
    var finalConflictArray = [];
    var alertTextSingle = "You have a scheduling conflict!";
    var alertTextMulti = "You have scheduling conflicts!";
    var dialogConflictArray = []; // for edit/enroll/plan/wait-list dialogs
    var dialogFinalConflictArray = []; // for edit/enroll/plan/wait-list
    // dialogs

    // calendar globals
    // color for calendar and final css classes

    var enClass = "wr-grid-en";
    var wtClass = "wr-grid-wt";
    var plClass = "wr-grid-pl";
    var evClass = "wr-grid-ev";

    var alwaysDisableClass = "alwaysdisable";

    var timeObjArrCal = [];
    timeObjArrCal.length = 0;
    var eventGroupMap = {};
    eventGroupMap.length = 0;
    var duplicateCalSections = [];
    duplicateCalSections.length = 0;

    var academicIntegrityMap = {};

    // initialize min and max times
    var calendarMinTime = "23";
    var calendarMaxTime = "00";
    var calEmpty;

    // final globals
    var timeObjArrFinal = [];
    timeObjArrFinal.length = 0;

    // initialize min and max times
    var finalMinTime = "23";
    var finalMaxTime = "00";
    var finalsEmpty = false;

    // search globals/constants
    var groupRowSectionClass = 'wr-search-group-row-section-';

    // floater
    $.fn.floaterJump = function()
    {
        $('html, body').animate({
            scrollTop : $(this).offset().top
                + 'px'
        }, 'fast');
        return this;
    }

    $('#wr-floater-img1').click(function()
    {
        $('#mainpage-div1-span1').floaterJump();
    });

    $('#wr-floater-img2').click(function()
    {
        $('#bottom-jumper').floaterJump();
    });

    function reposeFloater()
    {
        var ww = $(window).width();
        var center = 960;
        var both = ww
            - center;

        if (both > 85)
        {
            var half = Math.round(both / 2);
            var left = half
                + center
                + 10;
            $('.wr-floater-img-class').css('left', left);
            $('.wr-floater-img-class').show();
        }
        else
        {
            $('.wr-floater-img-class').hide();
        }
    }
    reposeFloater();

    $(window).on("resize", function()
    {
        reposeFloater();
    })

    // tooltip
    $(document).tooltip({
        show : {
            delay : 100, duration : 1000
        }
    });

    // wrappers ******************************************
    function wrapperGetDisplayName(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/get-current-name', dataType : 'text', // we get string
            type : 'GET', async : false, successF : sucFunc
        });
    }

    function wrapperCheckEligibility(termCode, seqId, logged, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/check-eligibility', dataType : 'json', // we get string
            type : 'GET', async : false, data : {
                "termcode" : termCode, "seqid" : seqId, "logged" : logged
            }, successF : sucFunc
        });
    }

    function wrapperCheckAcademicIntegrity(section, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/check-academic-integrity', dataType : 'json', // we get string
            type : 'GET', async : false, data : {
                "section" : section, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetStatusStartMain(termCode, seqId, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/get-status-start', dataType : 'json', type : 'GET', async : false, data : {
                "termcode" : termCode, "seqid" : seqId
            }, successF : sucFunc
        });
    }

    function wrapperGetTerm(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/get-term', dataType : 'json', type : 'GET', async : false, // MUST BE SYNC
            // (checkEligibility
            // is dependent
            // on
            // it)
            successF : sucFunc
        });
    }

    function wrapperGetMsgToProceed(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/get-msg-to-proceed', dataType : 'json', type : 'GET', async : false, data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetErrorMessage(code, sucFunc)
    {
        //alert('in wrapperGetErrorMessage')
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-error-message', dataType : 'json', type : 'POST', async : false, // MUST
            // BE
            // SYNC
            data : {
                "code" : code, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetUnitOptions(sectionHead, subjCode, crseCode, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-unit-options', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "section" : sectionHead, "subjcode" : subjCode, "crsecode" : crseCode, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperCheckDropEnrollWarn(sectionHead, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/check-drop-enroll-warn', dataType : 'json', type : 'POST', async : false, // MUST
            // BE
            // ASYNC
            data : {
                "sectnum" : sectionHead, "termcode" : urlParam1
            }, successF : sucFunc

        });
    }

    function wrapperCheckDropFinancial(termYear, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/check-drop-financial', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // ASYNC
            data : {
                "termyear" : termYear, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperSendMail(actionEvent, sucFunc)
    {
        // var textEvent = $('<div></div>').html( actionEvent).text();
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/send-email', dataType : 'json', type : 'POST', async : false, // MUST
            // BE
            // ASYNC
            data : {
                // "actionevent" : textEvent
                "actionevent" : actionEvent, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperDropEnroll(isEnroll, sectionHead, subjCode, crseCodeWellForm, sucFunc)
    {
        var enrollUrl = isEnroll ? '/webreg2/svc/wradapter/secure/drop-enroll' : '/webreg2/svc/wradapter/secure/drop-wait';
        ajaxExe({
            url : enrollUrl, dataType : 'json', type : 'POST', data : {
                "section" : sectionHead, "subjcode" : subjCode, "crsecode" : crseCodeWellForm, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperChangeEnroll(isEnroll, sectionHead, subjCode, crseCode, gradeVal, unitVal, oldGrade, oldUnit, sucFunc)
    {
        var enrollUrl = isEnroll ? '/webreg2/svc/wradapter/secure/change-enroll' : '/webreg2/svc/wradapter/secure/change-wait';
        ajaxExe({
            url : enrollUrl,
            dataType : 'json',
            type : 'POST',
            data : {
                "section" : sectionHead,
                "subjCode" : subjCode,
                "crseCode" : crseCode,
                "grade" : gradeVal,
                "unit" : unitVal,
                "oldGrade" : oldGrade,
                "oldUnit" : oldUnit,
                "termcode" : urlParam1
            },
            successF : sucFunc
        });
    }

    function wrapperGetMsgHolds(sucFunc)
    {
        //alert('IN wrapperGetMsgHolds');
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-msg-holds', dataType : 'json', type : 'GET', data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetMsgStatus(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-msg-status', dataType : 'json', type : 'GET', data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetMsgPass(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-msg-pass', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // ASYNC
            data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetErrorType4(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-error-type4', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetMsgGlobal(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-msg-global', dataType : 'json', type : 'GET', data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetStatusEligflags(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-status-eligflags', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // ASYNC
            data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperCheckStatusButton(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/check-status-button', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // ASYNC
            data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperCheckStatusWaitlistable(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/check-status-waitlistable', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // ASYNC
            data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetClass(schedName, finalVal, sectionNumber, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-class', dataType : 'json', type : 'GET', async : false, data : {
                "schedname" : schedName, "final" : finalVal, "sectnum" : sectionNumber, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetPreauthInfo(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-preauth-info', dataType : 'json', async : false, // MUST BE ASYNC
            type : 'GET', data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetFinalLocationOption(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-final-location-option', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetFinalSat2(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-final-sat2', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetInstEmailAddr(emailRef, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/search-inst-email-addr', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "emailref" : emailRef, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperAddEnroll(isWt, sectionHead, gradeVal, unitVal, subjCode, crseCodeWellForm, sucFunc)
    {
        if (isWt)
        {
            var enUrl = '/webreg2/svc/wradapter/secure/add-wait';
        }
        else
        {
            var enUrl = '/webreg2/svc/wradapter/secure/add-enroll';
        }

        ajaxExe({
            url : enUrl, dataType : 'json', type : 'POST', data : {
                "section" : sectionHead, "grade" : gradeVal, "unit" : unitVal, "subjcode" : subjCode, "crsecode" : crseCodeWellForm, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperPlanAdd(schedName, subjCode, crseCode, sectionHead, sectCode, gradeVal, unitVal, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/plan-add',
            dataType : 'json',
            async : false, // MUST BE SYNC
            type : 'POST',
            data : {
                "schedname" : schedName,
                "subjcode" : subjCode,
                "crsecode" : crseCode,
                "sectnum" : sectionHead,
                "sectcode" : sectCode,
                "grade" : gradeVal,
                "unit" : unitVal,
                "termcode" : urlParam1
            },
            successF : sucFunc
        });
    }

    function wrapperPlanRemove(schedName, sectionHead, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/plan-remove', dataType : 'json', async : false, // MUST BE SYNC
            type : 'POST', data : {
                "schedname" : schedName, "sectnum" : sectionHead, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperPlanRemoveAll(sectionHead, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/plan-remove-all', dataType : 'json', async : false, // MUST BE SYNC
            type : 'POST', data : {
                "sectnum" : sectionHead, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperSchedRemove(schedName, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/sched-remove', dataType : 'json', async : false, // MUST BE SYNC
            type : 'POST', data : {
                "schedname" : schedName, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperPlanRename(oldSchedName, newSchedName, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/plan-rename', dataType : 'json', async : false, // MUST BE SYNC
            type : 'POST', data : {
                "oldschedname" : oldSchedName, "newschedname" : newSchedName, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperPlanCopy(oldSchedName, newSchedName, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/plan-copy', dataType : 'json', async : false, // MUST BE SYNC
            type : 'POST', data : {
                "oldschedname" : oldSchedName, "newschedname" : newSchedName, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperPlanCount(schedName, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/plan-count', dataType : 'json', async : false, // MUST BE SYNC
            type : 'GET', data : {
                "schedname" : schedName, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperEditEnroll(isWt, sectionHead, subjCode, crseCode, sucFunc)
    {
        if (isWt)
        {
            var enEditUrl = '/webreg2/svc/wradapter/secure/edit-wait';
        }
        else
        {
            var enEditUrl = '/webreg2/svc/wradapter/secure/edit-enroll';
        }

        ajaxExe({
            url : enEditUrl, dataType : 'json', type : 'POST', data : {
                "section" : sectionHead, "subjcode" : subjCode, "crsecode" : crseCode, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperEditPlan(sectionHead, subjCode, crseCode, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/edit-plan', dataType : 'json', type : 'POST', data : {
                "section" : sectionHead, "subjcode" : subjCode, "crsecode" : crseCode, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetEnrollAddDates(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-enroll-add-dates', dataType : 'json', async : false, // MUST BE
            // SYNC
            type : 'GET', data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperSearchBySectionid(sectionId, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/search-by-sectionid', dataType : 'json', type : 'GET', data : {
                "sectionid" : sectionId, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperSearchByAll(subjCode, crseCode, dep, prof, title, levels, days, timeStr, openSection, isBasic, basicSearchValue, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/search-by-all',
            dataType : 'json',
            type : 'GET',
            data : {
                "subjcode" : subjCode,
                "crsecode" : crseCode,
                "department" : dep,
                "professor" : prof,
                "title" : title,
                "levels" : levels,
                "days" : days,
                "timestr" : timeStr,
                "opensection" : openSection,
                "isbasic" : isBasic,
                "basicsearchvalue" : basicSearchValue,
                "termcode" : urlParam1

            },
            successF : sucFunc
        });
    }

    function wrapperSearchGetCrseText(subjCodeListStr, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/search-get-crse-text', dataType : 'json', type : 'GET', data : {
                "subjlist" : subjCodeListStr, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperSearchGetCrseList(termCode, subjCodeListStr, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/search-get-crse-list', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "termcode" : termCode, "subjlist" : subjCodeListStr
            }, successF : sucFunc
        });
    }

    function wrapperSearchLoadGroupData(subjCodeNoSpaceForCache, crseCode, crseCodeWellForm, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/search-load-group-data', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "subjcode" : subjCodeNoSpaceForCache.toString().toUpperCase(), "crsecode" : crseCodeWellForm.toString().toUpperCase(), "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperSearchGetSectionText(sectNumListStr, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/search-get-section-text', dataType : 'json', async : false, // MUST
            // BE
            // SYNC
            type : 'GET', data : {
                "sectnumlist" : sectNumListStr, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperSearchGetRestriction(subjCode, crseCodeWellForm, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/search-get-restriction', dataType : 'json', async : false, // MUST BE
            // SYNC
            type : 'GET', data : {
                "subjcode" : subjCode, "crsecode" : crseCodeWellForm, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperSearchGetCatalog(subjCode, crseCodeWellForm, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/search-get-catalog', dataType : 'json', async : false, // MUST BE SYNC
            type : 'GET', data : {
                "subjcode" : subjCode, "crsecode" : crseCodeWellForm, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperSearchLoadSubject(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/search-load-subject', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperSearchLoadDepartment(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/search-load-department', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperWrLogger(sectNum, subjCode, crseCode, action, result)
    {

        ajaxExe({
            url : '/webreg2/svc/wradapter/wr-logger', dataType : 'json', type : 'POST', data : {
                "sectnum" : sectNum, "subjcode" : subjCode, "crsecode" : crseCode.trim(), "action" : action, "result" : result, "termcode" : urlParam1
            }, error : function(data)
            {
                return;
            }
        });
    }

    function wrapperWrLoggerStatus(termCode, result)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/wr-logger', dataType : 'json', type : 'POST', data : {
                "sectnum" : 0, "subjcode" : 'N/A', "crsecode" : 'N/A', "action" : 'CHECK ELIGIBILITY', "result" : "Fail: "
                    + result, "termcode" : termCode
            }, error : function(data)
            {
                return;
            }
        });
    }

    function wrapperCheckAndGetGradeUnit(sectionNumber, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/check-and-get-grade-unit', dataType : 'json', type : 'POST', async : false, // MUST
            // BE
            // SYNC
            data : {
                "section" : sectionNumber, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetEnrollDetail(sectNumList, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-enroll-detail', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "sectnumlist" : sectNumList, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperEventAdd(aeName, aeDays, aeStartTime, aeEndTime, aeLocation, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/event-add', dataType : 'json', type : 'POST', async : false, // MUST
            // BE
            // SYNC
            data : {
                "aename" : aeName, "aedays" : aeDays, "aestarttime" : aeStartTime, "aeendtime" : aeEndTime, "aelocation" : aeLocation, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperEventGet(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/event-get', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperEventRemove(aeTimeStamp, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/event-remove', dataType : 'json', type : 'POST', async : false, // MUST
            // BE
            // SYNC
            data : {
                "aetimestamp" : aeTimeStamp, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperEventEdit(aeTimeStamp, aeName, aeDays, aeStartTime, aeEndTime, aeLocation, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/event-edit',
            dataType : 'json',
            type : 'POST',
            async : false, // MUST BE SYNC
            data : {
                "aetimestamp" : aeTimeStamp,
                "aename" : aeName,
                "aedays" : aeDays,
                "aestarttime" : aeStartTime,
                "aeendtime" : aeEndTime,
                "aelocation" : aeLocation,
                "termcode" : urlParam1
            },
            successF : sucFunc
        });
    }

    function wrapperGetSchednames(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/sched-get-schednames', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "termcode" : urlParam1
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

    function wrapperGetMajorRestrictions(subjCode, crseCode, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-major-restrictions', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "subjcode" : subjCode, "crsecode" : crseCode, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetCollegeRestrictions(subjCode, crseCode, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-college-restrictions', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "subjcode" : subjCode, "crsecode" : crseCode, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetAcademicLevelRestrictions(subjCode, crseCode, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-academic-level-restrictions', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "subjcode" : subjCode, "crsecode" : crseCode, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetClassLevelRestrictions(subjCode, crseCode, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-class-level-restrictions', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "subjcode" : subjCode, "crsecode" : crseCode, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetPrerequisites(subjCode, crseCode, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-prerequisites', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "subjcode" : subjCode, "crsecode" : crseCode, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperGetAcademicLevelForCourse(subjCode, crseCode, sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-academic-level-for-course', dataType : 'json', type : 'GET', async : false, // MUST
            // BE
            // SYNC
            data : {
                "subjcode" : subjCode, "crsecode" : crseCode, "termcode" : urlParam1
            }, successF : sucFunc
        });
    }

    function wrapperPingSessionController(sucFunc)
    {
        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/ping-server', dataType : 'json', type : 'GET', async : true, successF : sucFunc
        });
    }

    var loggedUrls = {
        "EDITELIG" : "/webreg2/svc/wradapter/check-eligibility",
        "DEL-ENRL" : "/webreg2/svc/wradapter/secure/drop-enroll",
        "DEL-WAIT" : "/webreg2/svc/wradapter/secure/drop-wait",
        "CHG-ENRL" : "/webreg2/svc/wradapter/secure/change-enroll",
        "CHG-WAIT" : "/webreg2/svc/wradapter/secure/change-wait",
        "ADD-WAIT" : "/webreg2/svc/wradapter/secure/add-wait",
        "ADD-ENRL" : "/webreg2/svc/wradapter/secure/add-enroll",
        "EDITWAIT" : "/webreg2/svc/wradapter/secure/edit-wait",
        "EDITENRL" : "/webreg2/svc/wradapter/secure/edit-enroll"
    };

    function ajaxExe(obj)
    {
        var proceed = true;

        var ajaxObj = {
            // required or reference error
            url : obj.url,

            // defaults
            type : 'GET',
            cache : false,
            crossDomain : true,

            error : function(jqXHR, status, jQerr)
            {

                // service timeout (spring)
                if (jqXHR.status === 0
                    && status == "timeout")
                {
                    displayGeneralErrorMsg("<div class='msg error'><h4>Service Unavailable</h4><span>We're currently experiencing unusually high traffic.  Please try again in a few minutes.</span></div>");
                }
                // session timeout (jlink)
                else if (jqXHR.status === 0
                    || jqXHR.status == 307)
                {
                    redirectToTop();
                    // window.location.replace("/webreg2/");
                }
                else
                {
                    displayGeneralErrorMsg("<div class='msg error'><h4>System Error</h4><span>Please try again and if the error persists report the problem at servicedesk@ucsd.edu</span></div>");
                }
                return;
            }

            ,
            success : function(data)
            {
                if ((data.VERIFY != undefined && data.VERIFY == "FAIL")
                    || data[0] != undefined
                    && data[0].VERIFY != undefined
                    && data[0].VERIFY == "FAIL")
                {
                    // do longer eligible for changes
                    // shouldn't need to show the user anything because this
                    // should never happen
                    redirectToTop();
                }

                // ivory unavailable
                if (proceed
                    && ('successF' in obj))
                {
                    if (undefined != data.OPSIV
                        && "FAIL" == data.OPSIV
                        && undefined != data.IVORY_UNAVAIL_MSG)
                    {
                        proceed = false;
                        displayGeneralErrorMsg("<div class='msg error'><h4>Alert:</h4><span>"
                            + data.IVORY_UNAVAIL_MSG
                            + "</span></div>");
                    }
                    if (proceed)
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

    $(document).ajaxStart(function()
    {
        $("body").addClass("wr-spinner-loading");
    });

    $(document).ajaxStop(function()
    {
        $("body").removeClass("wr-spinner-loading");
    });

    function displayGeneralErrorMsg(msg)
    {
        if (undefined != msg)
        {
            $("#dialog-msg-small").dialog('open');
            updateTips(msg);
        }
    }

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

    $('#wr-term-text').text("Term: "
        + termCodeText);

    var termsMap = {};
    wrapperGetTerm(function(data)
    {
        $("#mainpage-select-term").empty();
        termsMap = {};
        $.each(data, function(index, entry)
        {
            var termDesc = entry.termDesc;
            var seqId = entry.seqId;
            var termCode = entry.termCode;
            termsMap[termCode] = seqId;
            termDesc = getTermDisplay(termCode, termDesc);
            if (entry.termCode == urlParam1)
            {
                $("<option selected='selected' value='"
                    + seqId
                    + ":::"
                    + termCode
                    + "'>"
                    + termDesc
                    + "</option>").appendTo("#mainpage-select-term");
            }
            else
            {
                $("<option value='"
                    + seqId
                    + ":::"
                    + termCode
                    + "'>"
                    + termDesc
                    + "</option>").appendTo("#mainpage-select-term");
            }
        });

    });

    /*
     * FIRST CALL SO ELIGIBILITY IS UPDATED ON REFRESH. (but just after getTerm
     * for seqId)
     */
    // IF NOT FROM start.js THEN CHECK STATUS
    if (fromOutsideParam != undefined
        && fromOutsideParam.localeCompare("true") == 0)
    {
        getStatusStartMain(urlParam1, termsMap[urlParam1]);
    }

    var sTermVal = $("#mainpage-select-term option:selected").val();
    var sSeqId = (sTermVal.split(":::"))[0];

    var validTerm = false;

    wrapperGetTerm(function(data)
    {
        $.each(data, function(index, entry)
        {
            var termCode = entry.termCode;
            if (termCode == urlParam1)
            {

                validTerm = true;
            }
        });

        if (!validTerm)
        {
            window.location.replace('/webreg2/start');
        }
    });

    wrapperCheckEligibility(urlParam1, sSeqId, false, function(data)
    {

        if ('SUCCESS' != data.OPS)
        {
            window.location.replace('/webreg2/start');
        }
    });

    // page modules
    var got56 = false; // hold error
    var got64 = false; // appointment time error
    var got56or64 = false;
    var gotFtype = true; // enforce by default

    wrapperGetStatusEligflags(function(data)
    {
        if (undefined != data.ELIG_FLAGS)
        {
            if (1 == data.ELIG_FLAGS.toString().charAt(0))
            {
                got56 = true;
            }
            if (1 == data.ELIG_FLAGS.toString().charAt(1))
            {
                got64 = true;
            }
            if (got56
                || got64)
            {
                got56or64 = true;
            }
        }
    });

    wrapperGetErrorType4(function(data)
    {
        if (undefined != data.GOT_NO_FTYPE)
        {
            if (data.GOT_NO_FTYPE)
            {
                gotFtype = false;
            }
        }
    });

    /*
     * Appointment time auto-update functions.
     */
    var apptTimer;
    function setApptTimer(duration)
    {

        window.clearTimeout(idleTimer);
        apptTimer = window.setTimeout(apptTimerCallback, duration);
    }

    function apptTimerCallback()
    {

        wrapperCheckEligibility(urlParam1, termsMap[urlParam1], false, function(data)
        {

            window.clearTimeout(apptTimer);
            if ('SUCCESS' == data.OPS)
            {

                // reset flags
                got56 = false; // hold error
                got64 = false; // appointment time error
                got56or64 = false;
                gotFtype = true; // enforce by default

                wrapperGetStatusEligflags(function(data)
                {
                    if (undefined != data.ELIG_FLAGS)
                    {
                        if (1 == data.ELIG_FLAGS.toString().charAt(0))
                        {
                            got56 = true;
                        }
                        if (1 == data.ELIG_FLAGS.toString().charAt(1))
                        {
                            got64 = true;
                        }
                        if (got56
                            || got64)
                        {
                            got56or64 = true;
                        }
                    }
                });

                wrapperGetErrorType4(function(data)
                {
                    if (undefined != data.GOT_NO_FTYPE)
                    {
                        if (data.GOT_NO_FTYPE)
                        {
                            gotFtype = false;
                        }
                    }
                });

                if (got64)
                {
                    setApptTimer(10000);
                }
                else
                {
                    $("#dialog-msg-appttime").dialog('open');
                    resetAllButtons();
                }

            }
        });
    }

    /*
     * Enables all actions buttons. Used in conjunction with the button disable
     * function to
     */
    function enableAllButtons()
    {

        $('.wrbuttong').button().button('enable');
        $('.wrbuttong').removeAttr('title');

        $('.wrbuttons').button().button('enable');
        $('.wrbuttons').removeAttr('title');

        $('.wrbuttonc').button().button('enable');
        $('.wrbuttonc').removeAttr('title');

        $('.'
            + alwaysDisableClass).removeClass(alwaysDisableClass);
    }

    function resetAllButtons()
    {
        enableAllButtons();
        disableGridButtons();
        restrictCalendarButtons();
        searchDisableBut();
    }
    // / end appt timer related functions

    function classEditFun(classObj)
    {

        var sectionHead = classObj.data.sectionHead;
        var isEnroll = (classObj.data.enStatus == 'EN') ? true : false;

        var aLevel = urlParam2;

        // either rowid or eventid - not necessarily sequantial
        var objId = classObj.data.objid;

        var crseCode;
        var stitle;
        var unitDefault;
        var gradeDefault;
        var gradeEnable = false;
        var unitEnable = false;

        // clear values
        $("#diagclass-class-table-subj").empty();
        $("#diagclass-class-table-title").empty();
        $("#diagclass-class-table-grade-p").empty();
        $("#diagclass-class-table-unit-p").empty();
        $("#diagclass-class-table-code").empty();
        $("#diagclass-class-table-type").empty();
        $("#diagclass-class-table-days").empty();
        $("#diagclass-class-table-time").empty();

        $(".diagclass-class-table-no1234").remove();

        if (objId.toString().match(/^grid:/))
        {
            var id = objId.split(":")[1];
            var rowData = $("#list-id-table").jqGrid('getRowData', id);
            subjCode = rowData.SUBJ_CODE;
            crseCode = rowData.CRSE_CODE;
            stitle = rowData.CRSE_TITLE;
            unitDefault = rowData.SECT_CREDIT_HRS;
            gradeDefault = rowData.GRADE_OPTION;

            if (isEnroll)
            {
                if (rowData.GRADE_OPTN_CD_PLUS == '+')
                {
                    gradeEnable = true;
                }
                ;
                if (rowData.SECT_CREDIT_HRS_PL == '+')
                {
                    unitEnable = true;
                }
                ;
            }

        }
        else
        {
            var eventData = $('#calendar-id').fullCalendar('clientEvents', objId)[0];

            subjCode = eventData.subjCode;
            crseCode = eventData.crseCode;
            stitle = eventData.stitle;
            unitDefault = eventData.unitVal.toFixed(2);
            gradeDefault = eventData.gradeVal;

            if (isEnroll)
            {
                gradeEnable = eventData.gradeEnable;
                unitEnable = eventData.unitEnable;
            }
        }

        if (!isEnroll)
        { // waitlist
            var tmp = checkAndGetGradeUnit(sectionHead);
            gradeEnable = tmp[0];
            unitEnable = tmp[1];
        }

        var subjCrse = subjCode
            + crseCode;

        // class list
        var gridObj = $("#list-id-table");
        var ids = gridObj.jqGrid('getDataIDs');
        var classArr = [];
        for (var i = 0; i < ids.length; i++)
        {
            var rowId = ids[i];
            rowData = gridObj.jqGrid('getRowData', rowId);
            if (rowData.colstatus.match(/plan/i)) continue;
            if (undefined != rowData.PB_FRIEND
                && "true" == rowData.PB_FRIEND)
            {
                continue;
            }
            if (rowData.SECTION_HEAD == sectionHead)
            {
                var instType = convInstType(rowData.FK_CDI_INSTR_TYPE);
                var msg = {
                    key0 : instType, key1 : rowData.DAY_CODE, key2 : rowData.coltime, key3 : rowData.SECT_CODE, key4 : rowData.CRSE_TITLE
                };
                classArr.push(msg);
            }
        }

        var unitFrom = undefined;
        var unitTo = undefined;
        var unitInc = undefined;
        var crseCodeTmp = formatCrseCode(crseCode);

        if (unitEnable)
        {
            wrapperGetUnitOptions(sectionHead, subjCode, crseCode, function(data)
            {
                if ('YES' == data.UNIT)
                {
                    unitFrom = data.UNIT_FROM;
                    unitTo = data.UNIT_TO;
                    unitInc = data.UNIT_INC;
                }
            });
        }

        var $diagObj = $('#dialog-class').dialog('open');

        $diagObj.dialog('option', 'section', sectionHead);
        $diagObj.dialog('option', 'subjcode', subjCode);
        $diagObj.dialog('option', 'crsecode', crseCode);
        $diagObj.dialog('option', 'stitle', stitle);
        $diagObj.dialog('option', 'isenroll', isEnroll);

        $('#diagclass-class-table-subj').text(subjCrse);
        var title = classArr[0].key4.replace("<br>", "");

        $('#diagclass-class-table-title').text(title);
        $('#dialog-class-button-confirm').button('enable');

        // grade --------------------------
        var gradeP = $('#diagclass-class-table-grade-p');
        gradeP.empty();
        if (gradeEnable)
        {
            $diagObj.dialog('option', 'gradeenable', true);
            gradeP.append("<select class='diagxxx-class-table-td-select' id='diagclass-class-table-grade'></select>");
            var gradeSelect = $('#diagclass-class-table-grade');
            gradeSelect.empty();
            if (aLevel == 'UN')
            {
                gradeSelect.append($('<option></option>').val('L').html('Letter'));
                gradeSelect.append($('<option></option>').val('P').html('Pass / No Pass'));
            }
            else if (aLevel == 'GR')
            {
                gradeSelect.append($('<option></option>').val('L').html('Letter'));
                gradeSelect.append($('<option></option>').val('S').html('Satisfactory / Unsatisfactory'));
            }
            else if (aLevel == 'PH')
            {
                wrapperGetAcademicLevelForCourse(subjCode, crseCode, function(data)
                {
                    if (data.ACADEMIC_LEVEL == 'GR')
                    {
                        gradeSelect.append($('<option></option>').val('L').html('Letter'));
                    }
                    else
                    {
                        gradeSelect.append($('<option></option>').val('H').html('Honors Pass / Fail'));
                    }
                    gradeSelect.append($('<option></option>').val('S').html('Satisfactory / Unsatisfactory'));
                });
            }
            gradeSelect.val(gradeOptionGridDeConv(gradeDefault));
        }
        else
        {
            gradeP.text(gradeDefault);
            $diagObj.dialog('option', 'gradeenable', false);
        }
        $diagObj.dialog('option', 'oldgrade', gradeDefault);

        // units ----------------
        // unit=4 ; unitTo=12 ; unitFrom=1 ; unitInc=1 ; unitEnable = true;
        var unitP = $('#diagclass-class-table-unit-p');
        unitP.empty();
        if (unitEnable
            && undefined != unitFrom
            && undefined != unitTo
            && undefined != unitInc)
        {
            $diagObj.dialog('option', 'unitenable', true);
            unitP.append("<select class='diagxxx-class-table-td-select' id='diagclass-class-table-unit' ></select>");
            var unitSelect = $('#diagclass-class-table-unit');
            unitSelect.empty();
            var retObj = getUnitSelectVal(unitFrom, unitTo, unitInc, unitDefault);
            $.each(retObj.ob2, function(key, val)
            {
                unitSelect.append($('<option></option>').val(key).html(val));
            });
            unitSelect.val(retObj.ob1);
        }
        else
        {
            unitP.text(unitDefault);
            $diagObj.dialog('option', 'unitenable', false);
        }
        $diagObj.dialog('option', 'oldunit', unitDefault);

        // classinfo for edit class
        var classInfo = $('#diagclass-class-table');
        $('.diagclass-class-table-no1234').remove();

        $.each(classArr, function(index, entry)
        {
            if (0 == index)
            {
                $('#diagclass-class-table-code').text(entry.key3);
                $('#diagclass-class-table-mt').text(entry.key0);
                $('#diagclass-class-table-days').text(entry.key1);
                $('#diagclass-class-table-time').text(entry.key2);
            }
            else
            {

                if ("" == entry.key0.trim()
                    && "" == entry.key1.trim()
                    && "" == entry.key2.trim())
                {
                    return;
                }
                var rowDef = '<tr class="diaclass-class-table-extra-row diagclass-class-table-no1234" >';
                classInfo.append(rowDef
                    + '<td class="diagclass-class-table-empty"></td>'
                    + '<td class="diagclass-class-table-empty"></td>'
                    + '<td class="diagclass-class-table-empty"></td>'
                    + '<td class="diagclass-class-table-empty"></td>'
                    + '<td>'
                    + entry.key3
                    + '</td>'
                    + '<td>'
                    + convInstType(entry.key0)
                    + '</td>'
                    + '<td>'
                    + entry.key1
                    + '</td>'
                    + '<td>'
                    + entry.key2
                    + '</td>'
                    + '</tr>');
            }
        });

        // var isenroll = $(this).dialog('option', 'isenroll');
        // var section = $(this).dialog('option', 'section');
        // var oldGrade = $(this).dialog('option', 'oldgrade');
        // var oldUnit = $(this).dialog('option', 'oldunit');
        // var subjCode = $(this).dialog('option', 'subjcode');
        // var crseCode = $(this).dialog('option', 'crsecode');
        var action = (isEnroll) ? beginChangeAction : beginChangeWaitlistAction;

        wrapperWrLogger(sectionHead, subjCode.trim(), crseCode.trim(), action, '');

        updateTips("<b>Change grading option and/or units</b><br />");

    }
    ;

    function classDropFun(classObj)
    {
        var isEnroll = (classObj.data.enStatus == 'EN') ? true : false;
        var sectionHead = classObj.data.sectionHead;
        var warnMsg = '';

        // financial students
        var dropStop = false;
        var dropStopMsg = undefined;
        var IsS1 = urlParam1.match(/^S1/i);
        var IsS2 = urlParam1.match(/^S2/i);

        // only check financial aid status if dropping last enrolled course in a
        // summer session
        if (isEnroll
            && isSummerSession
            && numButtonEnrollRows <= 1)
        {

            var termYear = "20"
                + urlParam1.substring(2, 4);
            termYear = termYear - 1;
            var IsS1 = urlParam1.match(/^S1/i);
            var IsS2 = urlParam1.match(/^S2/i);
            wrapperCheckDropFinancial(termYear, function(data)
            {

                if (data.length > 0)
                {
                    if (data[0].DROP_OK !== undefined)
                    {
                        return false;
                    }
                }

                $.each(data, function(index, entry)
                {

                    if (undefined == dropStopMsg)
                    {
                        if (undefined != entry.ERR_MSG)
                        {
                            dropStop = true;
                            dropStopMsg = entry.ERR_MSG;

                            return false;
                        }
                    }

                    // if S1
                    // if AIDID.match(DLS*, DLU*, DLG*, DLP*, DLX* and ('AA' or 'BB' == SUT. CODE
                    // ITEM '5'))
                    // or AIDID.match(PGS, GS, CEFS, CESS, CARS, CEAS, CRFS, CRSS)
                    //
                    // if S2
                    // if AIDID.match(DLS*, DLU*, DLG*, DLP*, DLX* and ('BB' or 'AA' == SUT.CODE
                    // ITEM '6'))
                    // or AIDID.match(PGS,GS, CEFS, CESS, CARS, CEAS, CRFS, CRSS)

                    // TODO consider to handle the logic in Java service
                    /*
                     * if (IsS1) { if
                     * ((entry.AIDID.match(/^\s*DLS|^\s*DLU|^\s*DLG|^\s*DLP|^\s*DLX/i) &&
                     * 'AA' == entry.SUT.ITEM5)// entry.HOLD01) //||
                     * entry.AIDID.match(/^\s*PGS3|^\s*GS3|^\s*CA3R|^\s*CC3F|^\s*CC3S/i)) ||
                     * entry.AIDID.match(/^\s*PGS$|^\s*GS$|^\s*CEFS$|^\s*CESS$|^\s*CARS$|^\s*CEAS$|^\s*CRFS$|^\s*CRSS$/i)) {
                     * dropStop = true; return false; } } else if (IsS2) { if
                     * ((entry.AIDID.match(/^\s*DLS|^\s*DLU|^\s*DLG|^\s*DLP|^\s*DLX/i) &&
                     * 'BB' == entry.SUT.ITEM6)//entry.HOLD02) //||
                     * entry.AIDID.match(/^\s*PGS7|^\s*GS7|^\s*CA7R|^\s*CC7F|^\s*CC7S/i)) ||
                     * entry.AIDID.match(/^\s*PGS$|^\s*GS$|^\s*CEFS$|^\s*CESS$|^\s*CARS$|^\s*CEAS$|^\s*CRFS$|^\s*CRSS$/i)) {
                     * dropStop = true; return false; } } commented by Sowmya to
                     * move the logic to service
                     */
                });
            });
        }

        // class list
        var instType = '';
        var classArr = [];
        var gridObj = $("#list-id-table");
        var ids = gridObj.jqGrid('getDataIDs');

        for (var i = 0; i < ids.length; i++)
        {
            var rowId = ids[i];
            rowData = gridObj.jqGrid('getRowData', rowId);
            if (rowData.colstatus.match(/plan/i)) continue;
            if (undefined != rowData.PB_FRIEND
                && "true" == rowData.PB_FRIEND)
            {
                continue;
            }
            if (rowData.SECTION_HEAD == sectionHead)
            {

                instType = convInstType(rowData.FK_CDI_INSTR_TYPE);

                if (undefined == instType
                    || instType.trim() == '')
                {
                    instType = rowData.FK_CDI_INSTR_TYPE;
                }

                var msg = {
                    key0 : rowData.colsubj,
                    key1 : rowData.CRSE_TITLE,
                    key2 : instType,
                    key3 : rowData.DAY_CODE,
                    key4 : rowData.coltime,
                    key5 : rowData.SUBJ_CODE,
                    key6 : rowData.CRSE_CODE,
                    key7 : gradeOptionConv(rowData.GRADE_OPTION),
                    key8 : rowData.SECT_CREDIT_HRS,
                    key9 : rowData.SECT_CODE
                };
                classArr.push(msg);
            }
        }

        if (dropStop)
        {
            var resultMsg = "FAIL: Attempting to drop the last summer class for financial student.";
            var tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>"
                + resultMsg
                + "</span></div>";
            if (undefined != dropStopMsg)
            {
                resultMsg = 'FAIL: '
                    + dropStopMsg;
                tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>"
                    + dropStopMsg
                    + "</span></div>";
            }

            var action = isEnroll ? beginDropAction : beginDropWaitlistAction;
            wrapperWrLogger(sectionHead, classArr[0].key5, classArr[0].key6, action, resultMsg);

            var $tmpDiag = $("#dialog-after-action").dialog('open');
            $tmpDiag.dialog('option', 'buttons', dialogAfterActionBut);
            $tmpDiag.dialog('option', 'actionevent', tipMsg);
            updateTips(tipMsg);
            return;
        }

        // Check academic integrity flag
        if ((IsS1
            || IsS2 || isSummerSession3)
            && checkAcademicIntegrityFlag(sectionHead))
        {
            var resultMsg = academicIntegrityMap[sectionHead].message;
            var tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>"
                + resultMsg
                + "</span></div>";
            resultMsg = "FAIL: "
                + resultMsg;

            var action = isEnroll ? beginDropAction : beginDropWaitlistAction;
            wrapperWrLogger(sectionHead, classArr[0].key5, classArr[0].key6, action, resultMsg);

            var $tmpDiag = $("#dialog-after-action").dialog('open');
            $tmpDiag.dialog('option', 'buttons', dialogAfterActionBut);
            $tmpDiag.dialog('option', 'actionevent', tipMsg);
            updateTips(tipMsg);
            return;
        }

        if (isEnroll)
        {
            wrapperCheckDropEnrollWarn(sectionHead, function(data)
            {
                if ('Y' == data.WARN_DROP)
                {
                    warnMsg = data.MSG;
                }
            });
        }

        var $diagObj = $("#dialog-confirm-drop").dialog('open');
        $diagObj.dialog('option', 'subjcrse', classArr[0].key0);
        $diagObj.dialog('option', 'subjcode', classArr[0].key5);
        $diagObj.dialog('option', 'crsecode', classArr[0].key6);
        $diagObj.dialog('option', 'stitle', classArr[0].key1);
        $diagObj.dialog('option', 'section', sectionHead);
        $diagObj.dialog('option', 'isenroll', isEnroll);

        // clear values
        $("#diagdrop-class-table-subj").empty();
        $("#diagdrop-class-table-title").empty();
        $("#diagdrop-class-table-grade-p").empty();
        $("#diagdrop-class-table-unit-p").empty();
        $("#diagdrop-class-table-code").empty();
        $("#diagdrop-class-table-type").empty();
        $("#diagdrop-class-table-days").empty();
        $("#diagdrop-class-table-time").empty();

        $(".diagdrop-class-table-no1234").remove();

        // set first row
        $("#diagdrop-class-table-subj").text(classArr[0].key0);

        var title = classArr[0].key1.replace("<br>", "");
        $("#diagdrop-class-table-title").text(title);
        $("#diagdrop-class-table-grade-p").text(classArr[0].key7);
        $("#diagdrop-class-table-unit-p").text(classArr[0].key8);
        $("#diagdrop-class-table-code").text(classArr[0].key9);
        $("#diagdrop-class-table-type").text(classArr[0].key2);
        $("#diagdrop-class-table-days").text(classArr[0].key3);
        $("#diagdrop-class-table-time").text(classArr[0].key4);

        // classinfo for drop - no edit
        var classInfo = $('#diagdrop-class-table');
        $('.diagdrop-class-table-extra-row').empty();

        $.each(classArr.slice(1), function(index, entry)
        {

            var rowDef = '<tr class="diagdrop-class-table-extra-row diagdrop-class-table-no1234" >';

            classInfo.append(rowDef
                + '<td class="diagclass-class-table-empty"></td>'
                + '<td class="diagclass-class-table-empty"></td>'
                + '<td class="diagclass-class-table-empty"></td>'
                + '<td class="diagclass-class-table-empty"></td>'
                + '<td>'
                + entry.key9
                + '</td>'
                + '<td>'
                + entry.key2
                + '</td>'
                + '<td>'
                + entry.key3
                + '</td>'
                + '<td>'
                + entry.key4
                + '</td>'
                + '</tr>');
        });
        if (isEnroll)
        {
            wrapperWrLogger(sectionHead, classArr[0].key5, classArr[0].key6, beginDropAction, warnMsg);
            updateTipsAlert("<div class='msg error'><h4>You are about to drop this class.</h4>"
                + warnMsg
                + "<b>You will be dropped from all components of this class.<br />Are you sure you would like to drop this class?</b></div>");
        }
        else
        {
            wrapperWrLogger(sectionHead, classArr[0].key5, classArr[0].key6, beginDropWaitlistAction, "");
            updateTipsAlert("<div class='msg error'><h4>You are about to drop this wait-listed class.</h4><b>You will be dropped from all components of this class.<br />Are you sure you would like to drop this class?</b></div>");
        }

    }
    ;

    function checkAcademicIntegrityFlag(section)
    {
        var integrityFlag = false;
        if (academicIntegrityMap.hasOwnProperty(section))
        {
            // use cached flag if available
            integrityFlag = academicIntegrityMap[section].flag;
        }
        else
        {
            var message = "";
            academicIntegrityMap[section] = {};
            wrapperCheckAcademicIntegrity(section, function(data)
            {
                if (data.ACAD_INTEGRITY_FL == "X")
                {
                    integrityFlag = true;
                    academicIntegrityMap[section].message = data.ERROR_MESSAGE;
                }
            });
            academicIntegrityMap[section].flag = integrityFlag
        }
        return integrityFlag;
    }

    function updateGridGradeUnit(sectHead, gradeVal, unitVal)
    {
        var thisObj = $("#list-id-table");
        var ids = thisObj.jqGrid('getDataIDs');
        for (var i = 0; i <= ids.length; i++)
        {
            var rowId = ids[i];
            rowData = thisObj.jqGrid('getRowData', rowId);
            if (rowData.SECTION_HEAD == sectHead)
            {
                if (rowData['GRADE_OPTION'].trim() != '')
                {
                    // TODO cellcheckrequired
                    thisObj.jqGrid('setCell', rowId, 'GRADE_OPTION', gradeOptionGridConv(gradeVal), '', {
                        'title' : gradeOptionConv(gradeVal)
                    });
                    thisObj.jqGrid('setCell', rowId, 'SECT_CREDIT_HRS', unitVal);
                }
            }
        }
    }

    function convInstType(type)
    {
        var ftype;
        switch (type)
        {
            case "LE":
                ftype = "Lecture";
                break;
            case "DI":
                ftype = "Discussion";
                break;
            case "LA":
                ftype = "Lab";
                break;
            case "IN":
                ftype = "Independent Study";
                break;
            case "SE":
                ftype = "Seminar";
                break;
            case "AC":
                ftype = "Activity";
                break;
            case "CL":
                ftype = "Clinical Clerkship";
                break;
            case "CN":
                ftype = "Clinic";
                break;
            case "CO":
                ftype = "Conference";
                break;
            case "FW":
                ftype = "Fieldwork";
                break;
            case "IT":
                ftype = "Internship";
                break;
            case "OP":
                ftype = "Outside Preparation";
                break;
            case "PR":
                ftype = "Practicum";
                break;
            case "SA":
                ftype = "Study Abroad";
                break;
            case "SI":
                ftype = "Simultaneous Enrlmnt-Other UC";
                break;
            case "ST":
                ftype = "Studio";
                break;
            case "TU":
                ftype = "Tutorial";
                break;
            case "FI":
                ftype = "Final Exam";
                break;
            case "MI":
                ftype = "Midterm";
                break;
            case "FM":
                ftype = "Film Sessions";
                break;
            case "PB":
                ftype = "Problem Sessions";
                break;
            case "OT":
                ftype = "Other Sessions";
                break;
            case "RE":
                ftype = "Review Sessions";
                break;
            case "MU":
                ftype = "Make-up Sessions";
                break;
            default:
                ftype = type;
        }
        return ftype;
    }

    function gradeOptionConv(type)
    {
        var ftype;
        switch (type)
        {
            case "L":
                ftype = "Letter";
                break;
            case "P":
                ftype = "Pass / No Pass";
                break;
            case "P/NP":
                ftype = "Pass / No Pass";
                break;
            case "S":
                ftype = "Satisfactory / Unsatisfactory";
                break;
            case "S/U":
                ftype = "Satisfactory / Unsatisfactory";
                break;
            case "H":
                ftype = "Honors Pass / Fail";
                break;
            default:
                ftype = type;
        }
        return ftype;
    }

    function gradeOptionDeConv(desc)
    {
        var ftype = "";
        if (desc.match(/lett/i))
        {
            ftype = "L";
        }
        else if (desc.match(/hono/i))
        {
            ftype = "H";
        }
        else if (desc.match(/pass/i))
        {
            ftype = "P";
        }
        else if (desc.match(/sati/i))
        {
            ftype = "S";
        }

        return ftype;
    }

    function gradeOptionGridConv(gradeOption)
    {
        var gradeOptionConv;
        switch (gradeOption)
        {
            case 'P':
                gradeOptionConv = 'P/NP';
                break;
            case 'S':
                gradeOptionConv = 'S/U';
                break;
            default:
                gradeOptionConv = gradeOption;
                break;
        }
        return gradeOptionConv;
    }

    function gradeOptionGridDeConv(gradeOption)
    {
        var gradeOptionConv;
        switch (gradeOption)
        {
            case 'P/NP':
                gradeOptionConv = 'P';
                break;
            case 'S/U':
                gradeOptionConv = 'S';
                break;
            default:
                gradeOptionConv = gradeOption;
                break;
        }
        return gradeOptionConv;
    }

    function gridString(str, width)
    {
        var retStr = "";
        var ret = '<span id="checkText">'
            + retStr
            + '</span>';
        var count = 0;
        while (ret.width() < width)
        {
            retStr += entry.slice(count, count + 1);
            ret = '<span id="checkText">'
                + retStr
                + '</span>';
            count++;
        }
        return ret;
    }

    /**
     * date format
     * 
     * 9XHHMM X: 0 - Sun
     */
    function dayConvNum2Str(dayCode)
    {
        var dayStr = "";
        if (/1/.test(dayCode))
        {
            dayStr = dayStr
                + "M";
        }
        if (/2/.test(dayCode))
        {
            dayStr = dayStr
                + "Tu";
        }
        if (/3/.test(dayCode))
        {
            dayStr = dayStr
                + "W";
        }
        if (/4/.test(dayCode))
        {
            dayStr = dayStr
                + "Th";
        }
        if (/5/.test(dayCode))
        {
            dayStr = dayStr
                + "F";
        }
        if (/6/.test(dayCode))
        {
            dayStr = dayStr
                + "Sa";
        }
        if (/7/.test(dayCode))
        {
            dayStr = dayStr
                + "Su";
        }
        return dayStr;

    }

    function getDateMil(ymdArg, hrArg, minArg)
    {
        // 2014-12-28 , 3 , 5 ==> mil sec
        var ymd = ymdArg.split('-');
        var hr = ("0" + hrArg).slice(-2);
        var min = ("0" + minArg).slice(-2);
        return new Date(ymd[0], (ymd[1] - 1), ymd[2], hr, min).getTime();
    }

    function timeConv24To12V2(timeMH)
    {
        if (':' == timeMH)
        {
            return "TBA";
        }
        return timeConv24To12(timeMH).replace(/p$/, ' .p.m').replace(/a$/, ' a.m.');
    }

    function timeConv24To12V2PST(timeMH)
    {
        if (':' == timeMH)
        {
            return "TBA";
        }
        return timeConv24To12(timeMH).replace(/p$/, ' p.m. PT').replace(/a$/, ' a.m. PT');
    }

    function timeConv24To12(timeMH)
    {
        // 08:35 => 08:35a
        // 0835 => 08:35a
        // dateNum 901315 Sun 01:15PM

        if (undefined == timeMH)
        {
            return "TBA";
        }

        var hour = "";
        var min = "";
        if (-1 == timeMH.indexOf(':'))
        {
            hour = timeMH.substring(0, 2);
            min = String("0"
                + timeMH.substring(2)).slice(-2);
        }
        else
        {
            var arr = timeMH.split(":");
            hour = arr[0];
            min = String("0"
                + arr[1]).slice(-2);
        }

        var ampm = "a";
        var timeStr = "";

        if (hour > 12)
        {
            ampm = "p";
            hour = hour - 12;
        }
        else if (hour == 12)
        {
            ampm = "p";
        }
        timeStr = hour
            + ":"
            + min
            + ampm;
        return timeStr;
    }

    function timeConv12To24(timeMH)
    {
        // 7:05am -> 0705 7:05pm -> 1905
        if ("" == timeMH
            || undefined == timeMH)
        {
            return "";
        }
        var body = timeMH.substr(0, timeMH.length - 2);
        var amPm = timeMH.substr(timeMH.length - 2).toLowerCase();
        var timeArr = body.split(":");
        if ('pm' == amPm
            && timeArr[0] != "12")
        {
            timeArr[0] = Number(timeArr[0]) + 12;
        }
        timeArr[0] = String("0"
            + timeArr[0]).slice(-2);
        return timeArr[0]
            + ""
            + timeArr[1];
    }

    function timeConvSE(beginHH, beginMM, endHH, endMM)
    {
        var timeStr = "TBA";
        var beginHM = beginHH
            + ":"
            + beginMM;
        var endHM = endHH
            + ":"
            + endMM;

        beginHM = timeConv24To12(beginHM);
        endHM = timeConv24To12(endHM);

        if (beginHH == 0
            && beginMM == 0
            && endHH == 0
            && endMM == 0)
        {
            timeStr = "TBA";
        }
        else
        {
            timeStr = beginHM
                + "-"
                + endHM;
        }
        return timeStr;
    }

    function dateConvFormat0(oDate)
    {
        // 01/03/1999 => 1999-01-03
        if (null == oDate
            || undefined == oDate)
        {
            return "TBA";
        }
        var arr = oDate.split("/");
        arr[0] = String("0"
            + arr[0]).slice(-2);
        arr[1] = String("0"
            + arr[1]).slice(-2);
        return arr[2]
            + "-"
            + arr[0]
            + "-"
            + arr[1];
    }

    function dateConvFormat1(oDate)
    {
        // 1999-01-03 => 01/03/1999
        if (null == oDate
            || undefined == oDate)
        {
            return "TBA";
        }
        var arr = oDate.split("-");
        arr[1] = String("0"
            + arr[1]).slice(-2);
        arr[2] = String("0"
            + arr[2]).slice(-2);
        return arr[1]
            + "/"
            + arr[2]
            + "/"
            + arr[0];
    }

    function dateConvFormat2(oDate)
    {
        // 2014-10-2 => October 2 2014
        if (null == oDate
            || undefined == oDate)
        {
            return "TBA";
        }
        var arr = oDate.split("-");
        arr[1] = String("0"
            + arr[1]).slice(-2);
        var month = arr[1];
        switch (arr[1])
        {
            case '01':
                month = 'January';
                break;
            case '02':
                month = 'February';
                break;
            case '03':
                month = 'March';
                break;
            case '04':
                month = 'April';
                break;
            case '05':
                month = 'May';
                break;
            case '06':
                month = 'June';
                break;
            case '07':
                month = 'July';
                break;
            case '08':
                month = 'August';
                break;
            case '09':
                month = 'September';
                break;
            case '10':
                month = 'October';
                break;
            case '11':
                month = 'November';
                break;
            case '12':
                month = 'December';
                break;
        }
        return month
            + " "
            + arr[2]
            + " "
            + arr[0];
    }

    function dateConvDate2Weekday(oDate)
    {
        // input: 1999-01-07

        if (null == oDate
            || undefined == oDate)
        {
            return "TBA";
        }

        var date1 = oDate.replace(/\D/g, ''); // remove non-digit
        var yy = date1.substr(0, 4);
        var mm = date1.substr(4, 2);
        mm = mm - 1;
        var dd = date1.substr(6, 2);

        var date2 = new Date();
        date2.setFullYear(yy, mm, dd);
        var dow = date2.getDay(); // 0=SUN

        var ret = "";
        switch (dow)
        {
            case 0:
                ret = 'Sunday';
                break;
            case 1:
                ret = 'Monday';
                break;
            case 2:
                ret = 'Tuesday';
                break;
            case 3:
                ret = 'Wednesday';
                break;
            case 4:
                ret = 'Thursday';
                break;
            case 5:
                ret = 'Friday';
                break;
            case 6:
                ret = 'Saturday';
                break;
            default:
                ret = dow.toString();
        }
        return ret;
    }

    function dateConvDB2Cal(dateNum)
    {
        // dateNum 971315 Sun 01:15PM
        // returns Date() object on current calendear view

        var wkidx = dateNum.substr(1, 1);
        var HH = dateNum.substr(2, 2);
        var MM = dateNum.substr(4, 2);

        var ymd = weekConvDB2Cal(wkidx);
        // wkidx = MON[1] - SUN[7]
        // return [ '2013', '11', '18' ];

        return new Date(ymd[0], ymd[1], ymd[2], HH, MM);
    }

    function weekConvDB2Cal(wkidx)
    {
        // wkidx = Mon[1] - Sun[7]
        // return [ '2013', '11', '18' ];
        var tmp = today_wd;
        if (0 == today_wd)
        {
            tmp = 7;
        }
        var diff = tmp
            - wkidx;
        var dd = today_d
            - diff;
        return [ today_y, today_m, dd ];
    }

    function updateTips(t)
    {
        var tipObj = $(".dialog-tip-class");
        tipObj.html(t);
    }
    ;

    function updateTips2(t)
    {
        var tipObj = $(".dialog-tip-class-2");
        tipObj.html(t);
    }
    ;

    function updateTipsAlert(t)
    {
        var tipObj = $(".dialog-tip-class-alert");
        tipObj.html(t);
    }
    ;

    function clearAppendTips(t)
    {
        var tipObj = $(".dialog-tip-class-2");
        tipObj.html('');
    }
    ;

    function removeTips()
    {
        $(".dialog-tip-class").empty();
    }
    ;

    function updateSearchTips(t)
    {
        $("#wr-search-notice-msg").html("<b>"
            + t
            + "</b>");
        $("#wr-search-notice").show();
    }
    ;

    function updateSearchTips2(t)
    {
        $("#search-pager-dropdown").hide();
        $("#search-pager-dropdown-header").hide();
        $("#search-pager").empty();
        $("#search-pager").hide();
        updateSearchTips(t);
    }
    ;

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

    function formatCrseCode(crseCode)
    {
        var range = crseCode.split("-");
        if (range.length > 1)
        {
            var code2 = formatCrseCode(range[1]);
            if (code2.match(/[A-Za-z]+/) === null)
            {
                code2 += 'ZZ';
            }
            return formatCrseCode(range[0])
                + "-"
                + formatCrseCode(code2);
        }
        var tmpNumPart = crseCode.replace(/[^0-9]|\s/g, "");
        var tmpChPart = crseCode.replace(/[0-9]|\s/g, "");
        tmpNumPart = String("   "
            + tmpNumPart).slice(-3); // padding to 3
        crseCode = tmpNumPart
            + tmpChPart;
        return crseCode;
    }

    function isEnrollOrWaitBut(sectHead, seat, stopFlag, subjCode, crseCode)
    {

        // availSeat could be "", num, Unlimited
        var gotSeat = (seat.toString().match(/^[1-9]/) || seat == "<b>") ? true : false;
        var gotStop = ('Y' == stopFlag) ? true : false;

        var isThisPreAuth = false;
        var hasAL = false;
        var hasEL = false;
        var hasSE = false;

        if (undefined != preauthData
            && preauthData.length > 0)
        {
            // Note that we are not checking 'LA'. LA is late add.
            // We only late add through preauth link in the main page. through
            // updatePreAuthLinks()
            // For planned classes, late add is not allowed.
            // After pass enroll time, planned class should just disappear.

            $.each(preauthData, function(index, entry)
            {

                if (entry.SUBJ_CODE.trim() == subjCode.trim()
                    && entry.CRSE_CODE.trim() == crseCode.trim())
                {

                    if (undefined != entry.SECTION_NUMBER
                        && sectHead != entry.SECTION_NUMBER)
                    {
                        return;
                    }

                    if ( // ALL
                    'AL' == entry.OVERRIDE_TYPE_1
                        || 'AL' == entry.OVERRIDE_TYPE_2
                        || 'AL' == entry.OVERRIDE_TYPE_3)
                    {
                        hasAL = true;
                    }

                    if ( // Enrollment Limit - seat
                    'EL' == entry.OVERRIDE_TYPE_1
                        || 'EL' == entry.OVERRIDE_TYPE_2
                        || 'EL' == entry.OVERRIDE_TYPE_3)
                    {
                        hasEL = true;
                    }

                    if ( // Stop Enrollment
                    'SE' == entry.OVERRIDE_TYPE_1
                        || 'SE' == entry.OVERRIDE_TYPE_2
                        || 'SE' == entry.OVERRIDE_TYPE_3)
                    {
                        hasSE = true;
                    }
                }
            });
        }

        if (hasAL)
        {
            return true;
        }
        if (hasEL)
        {
            gotSeat = true;
        }
        if (hasSE)
        {
            gotStop = false;
        }

        if (gotSeat
            && !gotStop)
        {
            return true;
        }
        else
        {
            return false;
        }
    }

    function rebuildTabs()
    {
        getClassData();
        checkForConflicts();
        gridBuildAll(); // this is big
        listEventBuildAll();
        buildCalendar();
        calendarPBBuildAll();
        finalBuildAll();
        rebuildOnDataChange();
    }

    function rebuildTabsEventChange()
    {
        buildCalendar();
        listEventBuildAll();
    }

    function rebuildOnDataChange()
    {
        bookListBuildAll();
        finalPostProcess();
        showHideAlert();
    }

    function checkForConflicts()
    {
        checkForScheduleConflicts();
        checkForFinalConflicts();
        showHideConflictAlert();
    }

    function showHideConflictAlert()
    {
        if (conflictArray.length > 0
            || finalConflictArray.length > 0)
        {

            $(".wr-schedule-conflict-header").html((conflictArray.length
                + finalConflictArray == 1) ? alertTextSingle : alertTextMulti);
            // build alert from schedule
            $(".wr-schedule-conflict").html("<ul>");
            $.each(conflictArray, function(index, entry)
            {
                $(".wr-schedule-conflict").append("<li>"
                    + entry[0].SUBJ_CODE.trim()
                    + " "
                    + entry[0].CRSE_CODE.trim()
                    + ((entry[0].FK_CDI_INSTR_TYPE == 'MI') ? " Midterm" : "")
                    + " and "
                    + entry[1].SUBJ_CODE.trim()
                    + " "
                    + entry[1].CRSE_CODE.trim()
                    + ((entry[1].FK_CDI_INSTR_TYPE == 'MI') ? " Midterm" : "")
                    + "</li>");
            });
            $.each(finalConflictArray, function(index, entry)
            {
                $(".wr-schedule-conflict").append("<li>"
                    + entry[0].SUBJ_CODE.trim()
                    + " "
                    + entry[0].CRSE_CODE.trim()
                    + " Final and "
                    + entry[1].SUBJ_CODE.trim()
                    + " "
                    + entry[1].CRSE_CODE.trim()
                    + " Final</li>");
            });
            $(".wr-schedule-conflict").append("</ul>");

            // show alert

            $("#wr-conflict-alert-box-id-div").show();
            $("#wr-conflict-alert-box-id-div-print").addClass("print-conflicts");
        }
        else
        {
            // hide
            $("#wr-conflict-alert-box-id-div").hide();
            $("#wr-conflict-alert-box-id-div-print").removeClass("print-conflicts");
        }
    }

    function showHideAlert()
    {

        if (alertFromFinalSat)
        {
            $("#wr-finals-alert-box-id-div").show();
        }
        else
        {
            $("#wr-finals-alert-box-id-div").hide();
        }
    }

    function rebuildTabsGrid()
    {
        getClassData();
        checkForConflicts();
        gridBuildAll(); // this is big
        rebuildOnDataChange();
    }

    function rebuildTabsCal()
    {
        getClassData();
        checkForConflicts();
        buildCalendar();
        calendarPBBuildAll();
        rebuildOnDataChange();
    }
    function rebuildTabsFinal()
    {
        getClassData();
        checkForConflicts();
        finalBuildAll();
        rebuildOnDataChange();
    }

    function checkAndGetGradeUnit(sectionHead)
    {
        var thisGradeEnable = false;
        var thisUnitEnable = false;
        if (undefined != checkAndGetGradeUnitObj[sectionHead])
        {
            thisGradeEnable = checkAndGetGradeUnitObj[sectionHead][0];
            thisUnitEnable = checkAndGetGradeUnitObj[sectionHead][1];
        }
        else
        {
            checkAndGetGradeUnitObj[sectionHead] = [];
            checkAndGetGradeUnitObj[sectionHead].length = 0;
            wrapperCheckAndGetGradeUnit(sectionHead, function(data)
            {
                if ('SUCCESS' == data.OPS)
                {
                    if ('YES' == data.GRADE)
                    {
                        thisGradeEnable = true;
                        checkAndGetGradeUnitObj[sectionHead][0] = true;
                    }
                    else
                    {
                        checkAndGetGradeUnitObj[sectionHead][0] = false;
                    }
                    if ('YES' == data.UNIT)
                    {
                        thisUnitEnable = true;
                        checkAndGetGradeUnitObj[sectionHead][1] = true;
                    }
                    else
                    {
                        checkAndGetGradeUnitObj[sectionHead][1] = false;
                    }
                }
            });
        }
        return [ thisGradeEnable, thisUnitEnable ];
    }

    function getStatusStartMain(termCode, seqId)
    {

        wrapperGetStatusStartMain(termCode, seqId, function(data)
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

                    displayGeneralErrorMsg("<div class='msg error'><h4>Alert:</h4><span>"
                        + data[0].ERROR_MESSAGE
                        + "</span></div>");
                    wrapperWrLoggerStatus(termCode, data[0].ERROR_MESSAGE);

                    // reset the term drop down
                    $("#mainpage-select-term").val(termsMap[urlParam1]);

                }
                else
                {
                    var aLevel = data[0].ACADEMIC_LEVEL;
                    checkEligibility(termCode, aLevel, seqId);
                }
            }

        });
    }

    function checkEligibility(termCode, aLevel, seqId)
    {
        // eligibility
        wrapperCheckEligibility(termCode, seqId, true, function(data)
        {

            if ('SUCCESS' == data.OPS)
            {
                wrapperGetMsgToProceed(function(data)
                {
                    var msg = data.WARN_MSG;
                    if (undefined != msg
                        && '' != msg.trim())
                    {
                        var paramObj = {
                            "p1" : termCode, "p2" : aLevel, "p4" : seqId
                        }
                        var str = $.param(paramObj);
                        window.location.replace('/webreg2/start?'
                            + str);
                    }
                    else
                    {
                        var paramObj = {
                            "p1" : termCode, "p2" : aLevel
                        }
                        var str = $.param(paramObj);
                        window.location.replace('/webreg2/main?'
                            + str);
                    }
                });

            }
            else
            {
                var paramObj = {
                    "p1" : termCode, "p2" : aLevel, "p4" : seqId
                }
                var str = $.param(paramObj);
                window.location.replace('/webreg2/start?'
                    + str);
            }

        }); // wrapperCheckEligibility
    }

    function updatePreAuthLinks()
    {

        $('#msg-preauth').empty();
        $.each(preauthData, function(index, entry)
        {
            var pSubjCode = entry.SUBJ_CODE;
            var pCrseCode = entry.CRSE_CODE;
            var pSectNum = entry.SECTION_NUMBER;
            var orType1 = entry.OVERRIDE_TYPE_1;
            var orType2 = entry.OVERRIDE_TYPE_2;
            var orType3 = entry.OVERRIDE_TYPE_3;

            if (null == pSubjCode
                || null == pCrseCode
                || undefined == pSubjCode
                || undefined == pCrseCode)
            {
                return;
            }

            if (orType1 != 'LA'
                && orType2 != 'LA'
                && orType3 != 'LA')
            {
                return;
            }

            var pSectNumMsg = '';
            if (undefined != pSectNum
                && pSectNum.toString().match(/^\d+$/))
            {
                pSectNumMsg = ', SECTION '
                    + pSectNum;
            }

            if (isAlreadyExist(undefined, pSubjCode, pCrseCode, 'ENWT')[0])
            { // enrolled or waitlisted
                return;
            }

            var br = '';
            if (index > 0)
            {
                br = '<br>';
            }

            var preauthMsg = 'YOU HAVE BEEN PREAUTHORIZED TO ENROLL in '
                + pSubjCode
                + pCrseCode.trim()
                + pSectNumMsg;
            $('#msg-preauth').append(br
                + '<span id="preauthid_'
                + index
                + '"><a href="#">'
                + preauthMsg
                + '</a></span>');
            $('#preauthid_'
                + index).click(function()
            {
                classSearchFun(pSubjCode, pCrseCode, pSectNum);
            });

        });

    }

    function isAlreadyExist(sectionNumber, subjCode, crseCode, look)
    {
        var result = [ false, null ];

        var checkSect = (undefined == subjCode || undefined == crseCode) ? true : false;

        switch (look)
        {
            case "ENWT":
                var enPattern = "EN|WT";
                break;
            case "PL":
                var enPattern = "PL";
                break;
            case "EN":
                var enPattern = "EN";
                break;
            case "WT":
                var enPattern = "WT";
                break;
            case "ALL":
                var enPattern = "EN|WT|PL";
                break;
        }
        var rePattern = new RegExp(enPattern);

        if (undefined != sectionNumber
            && !sectionNumber.toString().match(/^\s*\d{6}\s*$/))
        {
            var firstLine = sectionNumber.toString().split('\n')[0];
            sectionNumber = firstLine.replace(/^.*(\d{6}).*$/, '$1').trim();
        }

        if (checkSect)
        {
            if (undefined != cGlobDataSHList[sectionNumber])
            {
                if ('ALL' == look)
                {
                    result[0] = true;
                    result[1] = cGlobDataSHList[sectionNumber];
                }
                else if (cGlobDataSHList[sectionNumber].match(rePattern))
                {
                    result[0] = true;
                }
            }
        }
        else
        {
            $.each(cGlobData, function(index, entry)
            {
                subjCode = subjCode.trim();
                crseCode = crseCode.trim();
                if (entry.SUBJ_CODE.trim() == subjCode
                    && entry.CRSE_CODE.trim() == crseCode
                    && entry.ENROLL_STATUS.match(rePattern))
                {
                    result[0] = true;
                    return false;
                }
            });
        }
        return result;
    }

    function getUnitSelectVal(unitFrom, unitTo, unitInc, unitDefault)
    {
        var unitOpts = {};
        unitOpts['key0'] = Number(unitFrom).toFixed(2);
        var curVal = unitFrom;
        var selectVal = "";
        var max = (unitTo - unitFrom)
            * (1 / unitInc);
        for (var i = 0; i <= max; i++)
        {
            if (Number(curVal) == Number(unitDefault))
            {
                selectVal = "key"
                    + i;
            }
            curVal = curVal
                + unitInc;
            if (curVal > unitTo)
            {
                break;
            }
            unitOpts['key'
                + (i + 1)] = Number(curVal).toFixed(2);
        }
        return {
            ob1 : selectVal, ob2 : unitOpts
        };
    }

    // timepicker
    var tpOptions = {
        step : '15', minTime : '7:00am', maxTime : '10:00pm', useSelect : true, noneOption : 'none', showOnFocus : true
    };

    // timepicker events
    var tpOptionsEvents = {
        step : '5', minTime : '7:00am', maxTime : '10:00pm', useSelect : true, noneOption : 'none', showOnFocus : true
    };

    // dialogs -------------------------------------------------------

    /*
     * Dialog for selecting academic level for students with multiple levels for
     * a term.
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
                            displayGeneralErrorMsg("<div class='msg error'><h4>Alert:</h4><span>"
                                + data.ERROR_MESSAGE
                                + "</span></div>");
                        }
                        else
                        {
                            var termCode = thisdialog.dialog('option', 'termCode');
                            checkEligibility(termCode, aLevel, seqId);
                        }
                    });

                    return;

                }
            }
        }
    });

    $("#dialog-msg").dialog({
        autoOpen : false, maxWidth : 800, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 800, modal : true, closeOnEscape : false, buttons : {
            but1 : {
                text : 'Close', id : "dialog-msg-close", click : function()
                {
                    $(this).dialog("close");
                }
            }
        }
    });

    $("#dialog-msg-appttime").dialog({
        autoOpen : false, maxWidth : 800, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 800, modal : true, closeOnEscape : false, buttons : {
            but1 : {
                text : 'Close', id : "dialog-msg-close", click : function()
                {
                    $(this).dialog("close");
                }
            }
        }
    });

    $("#dialog-msg-small-redirect").dialog({
        autoOpen : false, maxWidth : 600, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 500, modal : true, closeOnEscape : false, buttons : {
            but1 : {
                text : 'Close', id : "dialog-msg-close", click : function()
                {
                    $(this).dialog("close");
                    window.location = '/webreg2';
                }
            }
        }
    });

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

    $("#dialog-msg-appt").dialog({
        autoOpen : false, maxWidth : 900, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 900, modal : true, closeOnEscape : false, buttons : {
            but1 : {
                text : 'Close', id : "dialog-msg-close", click : function()
                {
                    $(this).dialog("close");
                }
            }
        }
    });

    var dialogAfterActionBut = [ {
        text : 'Close', id : "dialog-after-action-close", click : function()
        {
            $(this).dialog("close");
            return;
        }
    }, {
        text : 'Send Me Email Confirmation', id : "dialog-after-action-email", click : function()
        {
            $(this).dialog("close");
            var actionEvent = $(this).dialog('option', 'actionevent');

            wrapperSendMail(actionEvent, function(data)
            {
                var tipMsg = '';
                if ('YES' == data.SUCCESS)
                {
                    tipMsg = "<div class='msg confirm'><h4>Email Sent Successfully</h4><span>Mail sent to "
                        + data.MAIL_ADDR
                        + "</span></div>";
                }
                else
                {
                    if (undefined != data.REASON)
                    {
                        tipMsg = "<div class='msg error'><h4>Email Sent Unsuccessfully</h4><span>"
                            + data.REASON
                            + "</span></div>";

                    }
                    else
                    {
                        tipMsg = "<div class='msg error'><h4>Email Sent Unsuccessfully</h4><span>Your confirmation email was unable to be sent.</span></div>";
                    }
                }
                $("#dialog-msg").dialog('open')
                updateTips(tipMsg);
                return;
            });

        }
    }

    ];

    $("#dialog-after-action").dialog({
        autoOpen : false, maxWidth : 800, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 800, modal : true, closeOnEscape : false, buttons : dialogAfterActionBut
    });

    $("#dialog-restrictions").dialog({
        autoOpen : false, maxWidth : 800, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 800, modal : true, closeOnEscape : false, buttons : {
            but1 : {
                text : 'Close', id : "dialog-msg-close", click : function()
                {
                    $(this).dialog("close");
                }
            }
        }
    });

    $("#dialog-prereqs").dialog({
        autoOpen : false, maxWidth : 800, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', maxHeight : 500, width : 800, modal : true, closeOnEscape : false, buttons : {
            but1 : {
                text : 'Close', id : "dialog-msg-close", click : function()
                {
                    $(this).dialog("close");
                }
            }
        }
    });

    $("#dialog-confirm-drop").dialog({
        autoOpen : false, maxWidth : 1050, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 1050, modal : true, closeOnEscape : false, buttons : {
            but1 : {
                text : 'Cancel', click : function()
                {
                    $(this).dialog("close");
                    return;
                }
            }, but2 : {
                text : 'Drop', click : function()
                {
                    $(this).dialog("close");
                    var sectionHead = $(this).dialog('option', 'section');
                    var isEnroll = $(this).dialog('option', 'isenroll');
                    var subjCrse = $(this).dialog('option', 'subjcrse');
                    var subjCode = $(this).dialog('option', 'subjcode');
                    var crseCode = formatCrseCode($(this).dialog('option', 'crsecode'));
                    var stitle = $(this).dialog('option', 'stitle');

                    var subjCodeTrim = subjCode.toString().trim();
                    var crseCodeTrim = crseCode.toString().trim();
                    var stitleTrim = stitle.toString().trim();
                    crseCodeWellForm = formatCrseCode(crseCode);

                    wrapperDropEnroll(isEnroll, sectionHead, subjCode, crseCodeWellForm, function(data)
                    {
                        var tipMsg = "";

                        if ('SUCCESS' == data.OPS)
                        {
                            rebuildTabs();
                            updatePreAuthLinks();
                            if (isEnroll)
                            {
                                tipMsg = "<div class='msg confirm'><h4>Request Successful</h4><span>Dropped "
                                    + subjCode.trim()
                                    + " "
                                    + crseCode.trim()
                                    + " "
                                    + stitleTrim
                                    + ", Section "
                                    + sectionHead
                                    + ".</span></div>";
                            }
                            else
                            {
                                tipMsg = "<div class='msg confirm'><h4>Request Successful</h4><span>Dropped wait-listed class "
                                    + subjCode.trim()
                                    + " "
                                    + crseCode.trim()
                                    + " "
                                    + stitleTrim
                                    + ", Section "
                                    + sectionHead
                                    + ".</span></div>";
                            }

                            if (sGridObj[0].grid)
                            {
                                if (undefined != sLocalDataCurrentPage)
                                {
                                    sLocalDataLoaded[sLocalDataCurrentPage] = $.extend(true, [], sLocalData);
                                    var jobDone = false;
                                    var reSectionHead = new RegExp(sectionHead);
                                    $.each(sLocalDataLoaded, function(i, thisPage)
                                    {
                                        if (undefined == thisPage
                                            || 0 == thisPage.length)
                                        {
                                            return;
                                        }
                                        var prevRow = undefined;

                                        $.each(thisPage, function(j, thisRow)
                                        {

                                            if (!jobDone
                                                && undefined != thisRow.SECTION_NUMBER
                                                && thisRow.SECTION_NUMBER.toString().match(reSectionHead))
                                            {

                                                if (undefined != thisRow.colaction
                                                    && !thisRow.colaction.match(/^\s*$/))
                                                {
                                                    thisRow.colaction = thisRow.colaction.replace(/disableSBSectionClass/g, ' ');
                                                }
                                                if (!isEnroll)
                                                {
                                                    if (undefined != thisRow.COUNT_ON_WAITLIST)
                                                    {
                                                        thisRow.COUNT_ON_WAITLIST = thisRow.COUNT_ON_WAITLIST.toString().replace(/\d+/g, function(n)
                                                        {
                                                            var val = Number(n) - 1;
                                                            if (val < 0) val = 0;
                                                            return val;
                                                        });
                                                    }
                                                }

                                                if (undefined != thisRow.AVAIL_SEAT)
                                                {
                                                    if (thisRow.AVAIL_SEAT.toString().match(/^\s*\d+\s*$/))
                                                    {
                                                        if (isEnroll)
                                                        {
                                                            thisRow.AVAIL_SEAT = thisRow.AVAIL_SEAT + 1;
                                                            // if seat is 1 now.
                                                            // must be Enroll
                                                            // not Waitlist.
                                                            prevRow.colaction = prevRow.colaction.replace(/Waitlist/i, 'Enroll');
                                                            prevRow.colaction = prevRow.colaction.replace(/search-wait-id-/, 'search-enroll-id-');
                                                        }
                                                        jobDone = true;
                                                    }
                                                }
                                            }

                                            if (thisRow.SUBJ_CODE == subjCodeTrim
                                                && thisRow.CRSE_CODE == crseCodeTrim)
                                            {
                                                if (isAlreadyExist(thisRow.SECTION_NUMBER, undefined, undefined, 'ALL')[0])
                                                {
                                                    return;
                                                }
                                                if (undefined != thisRow.colaction
                                                    && !thisRow.colaction.match(/^\s*$/))
                                                {
                                                    thisRow.colaction = thisRow.colaction.replace(/disableSBEnWtClass/g, ' ');
                                                    thisRow.colaction = thisRow.colaction.replace(/disableSBEnClass/g, ' ');
                                                    thisRow.colaction = thisRow.colaction.replace(/disableSBWtClass/g, ' ');
                                                    thisRow.colaction = thisRow.colaction.replace(/disableSBSectionClass/g, ' ');
                                                }
                                            }
                                            prevRow = thisRow;
                                        });
                                    });
                                    searchLoadGridPage(sLocalDataCurrentPage, false, false);
                                }
                            }

                        }
                        else
                        {
                            var reason = "";
                            if (undefined != data.REASON)
                            {
                                reason = data.REASON;
                            }

                            if (isEnroll)
                            {
                                tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Attempting to drop "
                                    + subjCrse.trim()
                                    + ", Section "
                                    + sectionHead
                                    + ".  "
                                    + reason
                                    + "</span></div>";
                            }
                            else
                            {
                                tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Attempting to drop wait-listed class "
                                    + subjCrse.trim()
                                    + ", Section "
                                    + sectionHead
                                    + ".  "
                                    + reason
                                    + "</span></div>";
                            }

                        }

                        var $tmpDiag = $("#dialog-after-action").dialog('open');
                        $tmpDiag.dialog('option', 'buttons', dialogAfterActionBut);
                        $tmpDiag.dialog('option', 'actionevent', tipMsg);
                        updateTips(tipMsg);
                    });

                    return;
                }
            }
        }
    });

    $("#dialog-class").dialog({
        autoOpen : false, maxWidth : 1050, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 1050, modal : true, closeOnEscape : false, buttons : {

            Cancel : {
                text : "Cancel", click : function()
                {
                    $(this).dialog("close");
                }
            },

            Confirm : {
                text : "Confirm", click : function()
                {
                    $(this).dialog("close");
                    var gradeVal = $('#diagclass-class-table-grade option:selected').val();
                    var unitVal = $('#diagclass-class-table-unit option:selected').text();

                    if (undefined == gradeVal
                        || gradeVal.trim() == '')
                    {
                        gradeVal = gradeOptionGridDeConv($('#diagclass-class-table-grade-p').text());
                    }
                    if (undefined == unitVal
                        || unitVal.trim() == '')
                    {
                        unitVal = $('#diagclass-class-table-unit-p').text();
                    }

                    var oldGrade = $(this).dialog('option', 'oldgrade');
                    var oldUnit = $(this).dialog('option', 'oldunit');
                    var subjCode = $(this).dialog('option', 'subjcode');
                    var crseCode = $(this).dialog('option', 'crsecode');
                    var subjCrse = subjCode
                        + crseCode;
                    var stitle = $(this).dialog('option', 'stitle');
                    var isEnroll = $(this).dialog('option', 'isenroll');

                    var gradeEnable = $(this).dialog('option', 'gradeenable');
                    var unitEnable = $(this).dialog('option', 'unitenable');

                    var didChange = false;

                    if (!gradeEnable
                        && !unitEnable)
                    {
                        didChange = true;
                    }
                    else if (gradeEnable
                        && (gradeVal != gradeOptionGridDeConv(oldGrade)))
                    {
                        didChange = true;
                    }
                    else if (unitEnable
                        && (unitVal != oldUnit))
                    {
                        didChange = true;
                    }

                    if (!didChange)
                    {
                        $("#dialog-msg").dialog('open');
                        var tipsMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>No change of information was requested for "
                            + subjCrse.trim()
                            + ": "
                            + stitle.trim()
                            + ".</span></div>";
                        updateTips(tipsMsg);

                        return;
                    }

                    var sectionHead = $(this).dialog('option', 'section');
                    unitVal = Number(unitVal).toFixed(2);

                    wrapperChangeEnroll(isEnroll, sectionHead, subjCode, crseCode, gradeVal, unitVal, gradeOptionGridDeConv(oldGrade), oldUnit, function(data)
                    {
                        var tipMsg = "";
                        var unitMsg = "units from "
                            + oldUnit
                            + " to "
                            + unitVal
                            + " for "
                            + subjCrse.trim()
                            + ", Section "
                            + sectionHead;
                        var gradeMsg = "grade option from "
                            + gradeOptionConv(oldGrade)
                            + " to "
                            + gradeOptionConv(gradeVal)
                            + " for "
                            + subjCrse.trim()
                            + ", Section "
                            + sectionHead;

                        if (undefined == unitVal
                            || unitVal.match(/^\s*$/)
                            || oldUnit == unitVal)
                        {
                            unitMsg = "";
                        }
                        if (undefined == gradeVal
                            || gradeVal.match(/^\s*$/)
                            || gradeOptionConv(oldGrade) == gradeOptionConv(gradeVal))
                        {
                            gradeMsg = "";
                        }

                        var comboMsg = "";
                        // both are changed need to make the message nicer
                        if (unitMsg != ""
                            && gradeMsg != "")
                        {
                            unitMsg = "units from "
                                + oldUnit
                                + " to "
                                + unitVal
                                + " and ";
                            comboMsg = unitMsg
                                + gradeMsg;
                        }
                        else if (unitMsg != "")
                        {
                            comboMsg = unitMsg;
                        }
                        else
                        {
                            comboMsg = gradeMsg;
                        }
                        if ('SUCCESS' == data.OPS)
                        {
                            updateGridGradeUnit(sectionHead, gradeVal, unitVal);
                            rebuildTabsCal();

                            tipMsg = "<div class='msg confirm'><h4>Request Successful</h4><span>Changed "
                                + comboMsg
                                + ".</span></div>";

                        }
                        else
                        {
                            var reason = "";
                            if (undefined != data.REASON
                                || "null" == data.REASON)
                            {
                                reason = data.REASON;
                            }
                            tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Attempting to change "
                                + comboMsg
                                + ".<br /><br />"
                                + reason
                                + "</span></div>";
                        }

                        var $tmpDiag = $("#dialog-after-action").dialog('open');
                        $tmpDiag.dialog('option', 'buttons', dialogAfterActionBut);
                        $tmpDiag.dialog('option', 'actionevent', tipMsg);
                        updateTips(tipMsg);
                    });

                    // $(this).dialog("close");
                    return;
                }
            }

        }
    });

    // history ------------------------------------------------------------
    var preHash = undefined;
    $.address.externalChange(function(e)
    {
        var newHash = e.value.substring(1);
        if (undefined != preHash)
        {
            // tab <--> tab
            if ('tabs' == preHash.substring(0, 4)
                && 'tabs' == newHash.substring(0, 4))
            {
                var tmp = newHash.substring(5, 6)
                $('#tabs').tabs({
                    active : tmp
                });
            }
        }
        preHash = newHash;

    });

    // tabs -----------------------------------------------------------------

    // default: 0 == list view
    var defaultTab = 0;

    var tabActive = undefined
    if ('#' != tabHash)
    {
        var tabHash = window.location.hash; // #tabs-0
        tabActive = tabHash.substring(6, 7);
    }
    if (undefined == tabActive
        || !tabActive.toString().match(/^\d$/))
    {
        tabActive = defaultTab;
    }

    // important
    window.location.hash = "tabs-"
        + tabActive;

    // general tab events
    $('#tabs').tabs({
        // event: "mouseover",
        active : tabActive, // default tab to list view
        activate : function(event, ui)
        {
            var tabix = $('#tabs').tabs("option", "active");
            window.location.hash = "tabs-"
                + tabix;
            tabActive = tabix;
            if (tabix == 1)
            { // cal
                $('#calendar-id').fullCalendar('render');
                $('#print-title').text(printTitle
                    + " - Calendar");
            }
            else if (tabix == 2)
            { // final
                $('#finalcal-id').fullCalendar('render');
                $('#print-title').text(printTitle
                    + " - Finals");
            }
            else
            {
                $('#print-title').text(printTitle);
            }
        }
    });

    var printTitle = "";
    // set print title
    wrapperGetDisplayName(function(data)
    {
        printTitle = data
            + " - "
            + termCodeText;
        $('#print-title').text(printTitle);
        if ('#' != tabHash)
        {
            var tab = tabHash.substring(6, 7);
            if (tab == 1)
            { // cal
                $('#print-title').text(printTitle
                    + " - Calendar");
            }
            else if (tab == 2)
            { // final
                $('#print-title').text(printTitle
                    + " - Finals");
            }
        }

    });

    // final location option
    var finalLocationDisplay = true;
    wrapperGetFinalLocationOption(function(data)
    {
        if ('NO' == data.DISPLAY)
        {
            finalLocationDisplay = false;
        }
    });

    // holds - may have multiple holds
    if (got56)
    {
        wrapperGetErrorMessage("992556", function(data)
        {
            if (undefined != data.KEY)
            {
                $("#msg-hold").html(data.KEY);
            }
        });
    }

    // enrollment information
    var enrollInfoLink = undefined;
    if ('UN' == urlParam2)
    {
        enrollInfoLink = 'http://students.ucsd.edu/go/enroll-checklist-ug';
        $('#enrollment-info-link').attr('href', enrollInfoLink);
    }
    else if ('GR' == urlParam2)
    {
        enrollInfoLink = 'http://students.ucsd.edu/go/enroll-checklist-grad';
        $('#enrollment-info-link').attr('href', enrollInfoLink);
    }
    else
    {
        $('#enrollment-info-link').remove();
        $('#enrollment-info-link-bar').remove();
    }

    // pass >>>appt time
    var apptPassInfo = undefined;
    var collegeCode = undefined;
    function addMsgPassInfo()
    {

        wrapperGetMsgPass(function(data)
        {

            // set timer to activate buttons on appt time
            if (data.APPT_TIMER != '')
            {
                if (data.APPT_TIMER >= 0)
                {
                    setApptTimer(data.APPT_TIMER);
                }
                else if (got64)
                {
                    // if appt time is up but not appt eligible then recheck
                    wrapperCheckEligibility(urlParam1, termsMap[urlParam1], false, function(data)
                    {
                        window.clearTimeout(apptTimer);
                        if ('SUCCESS' == data.OPS)
                        {
                            // reset flags
                            got56 = false; // hold error
                            got64 = false; // appointment time error
                            got56or64 = false;
                            gotFtype = true; // enforce by default
                            wrapperGetStatusEligflags(function(data)
                            {
                                if (undefined != data.ELIG_FLAGS)
                                {
                                    if (1 == data.ELIG_FLAGS.toString().charAt(0))
                                    {
                                        got56 = true;
                                    }
                                    if (1 == data.ELIG_FLAGS.toString().charAt(1))
                                    {
                                        got64 = true;
                                    }
                                    if (got56
                                        || got64)
                                    {
                                        got56or64 = true;
                                    }
                                }
                            });
                            wrapperGetErrorType4(function(data)
                            {
                                if (undefined != data.GOT_NO_FTYPE)
                                {
                                    if (data.GOT_NO_FTYPE)
                                    {
                                        gotFtype = false;
                                    }
                                }
                            });
                            if (!got64)
                            {
                                $("#dialog-msg-appttime").dialog('open');
                                resetAllButtons();
                            }
                        }
                    });
                }
            }

            collegeCode = data.COLLEGE_CODE;
            if ('NO' == data.DISPLAY)
            {
                return;
            }

            var pass1Exist = false;
            if (null != data.FIRST_BEGIN_DATE)
            {
                pass1Exist = true;
            }

            var pass2Exist = false;
            if (null != data.SECOND_BEGIN_DATE)
            {
                pass2Exist = true;
            }

            var firstPassHeader = "First Pass";
            var secondPassHeader = "Second Pass";

            if (pass1Exist
                || pass2Exist)
            {
                apptPassInfo = '<table id="dialog-msg-appt-table" ><tbody>';
            }

            if (pass1Exist
                && pass2Exist)
            {
                var dowBegin1 = dateConvDate2Weekday(data.FIRST_BEGIN_DATE);
                var dowEnd1 = dateConvDate2Weekday(data.FIRST_END_DATE);
                var firstBeginDate = dateConvFormat1(data.FIRST_BEGIN_DATE);
                var firstEndDate = dateConvFormat1(data.FIRST_END_DATE);
                var firstBeginTime = timeConv24To12V2PST(data.FIRST_BEGIN_HOUR
                    + ":"
                    + data.FIRST_BEGIN_MIN);
                var firstEndTime = timeConv24To12V2PST(data.FIRST_END_HOUR
                    + ":"
                    + data.FIRST_END_MIN);

                var firstEndDateMil = getDateMil(data.FIRST_END_DATE, data.FIRST_END_HOUR, data.FIRST_END_MIN);
                if (todayGetTime > firstEndDateMil)
                {
                    firstPassHeader = firstPassHeader
                        + " (Not Active)";
                }

                var start1 = dowBegin1
                    + ', <span>'
                    + firstBeginDate
                    + '</span> '
                    + firstBeginTime;

                var end1 = dowEnd1
                    + ', <span>'
                    + firstEndDate
                    + '</span> '
                    + firstEndTime;

                var dowBegin2 = dateConvDate2Weekday(data.SECOND_BEGIN_DATE);
                var dowEnd2 = dateConvDate2Weekday(data.SECOND_END_DATE);
                var secondBeginDate = dateConvFormat1(data.SECOND_BEGIN_DATE);
                var secondEndDate = dateConvFormat1(data.SECOND_END_DATE);
                var secondBeginTime = timeConv24To12V2PST(data.SECOND_BEGIN_HOUR
                    + ":"
                    + data.SECOND_BEGIN_MIN);
                var secondEndTime = timeConv24To12V2PST(data.SECOND_END_HOUR
                    + ":"
                    + data.SECOND_END_MIN);

                var secondEndDateMil = getDateMil(data.SECOND_END_DATE, data.SECOND_END_HOUR, data.SECOND_END_MIN);
                if (todayGetTime > secondEndDateMil)
                {
                    secondPassHeader = secondPassHeader
                        + " (Not Active)";
                }

                var start2 = dowBegin2
                    + ', <span>'
                    + secondBeginDate
                    + '</span> '
                    + secondBeginTime;

                var end2 = dowEnd2
                    + ', <span>'
                    + secondEndDate
                    + '</span> '
                    + secondEndTime;

                apptPassInfo = apptPassInfo
                    + ' '
                    + '<tr>'
                    + ' <td style="font-weight:bold; ">'
                    + ' <span>'
                    + firstPassHeader
                    + '</span>'
                    + ' </td>'
                    + ' <td style=" font-weight:bold; ">'
                    + ' <span>'
                    + secondPassHeader
                    + '</span>'
                    + ' </td>'
                    + ' </tr>'

                    + '<tr>'
                    + '<td><span>Start date/time: '
                    + start1
                    + '</span></td>'
                    + '<td><span>Start date/time: '
                    + start2
                    + '</span></td>'
                    + '</tr>'

                if (!urlParam1.startsWith('SU')
                    && !urlParam1.startsWith('S1')
                    && !urlParam1.startsWith('S2')
                    && !urlParam1.startsWith('S3'))
                {
                    apptPassInfo = apptPassInfo
                        + '<tr>'
                        + '<td><span>End date/time: '
                        + end1
                        + '</span></td>'
                        + '<td><span>End date/time: '
                        + end2
                        + '</span></td>'
                        + '</tr>'
                }

            }
            else if (pass1Exist
                && !pass2Exist
                || !pass1Exist
                && pass2Exist)
            {

                if (pass1Exist)
                {
                    var dowBegin1 = dateConvDate2Weekday(data.FIRST_BEGIN_DATE);
                    var dowEnd1 = dateConvDate2Weekday(data.FIRST_END_DATE);
                    var firstBeginDate = dateConvFormat1(data.FIRST_BEGIN_DATE);
                    var firstEndDate = dateConvFormat1(data.FIRST_END_DATE);
                    var firstBeginTime = timeConv24To12V2PST(data.FIRST_BEGIN_HOUR
                        + ":"
                        + data.FIRST_BEGIN_MIN);
                    var firstEndTime = timeConv24To12V2PST(data.FIRST_END_HOUR
                        + ":"
                        + data.FIRST_END_MIN);

                    var firstEndDateMil = getDateMil(data.FIRST_END_DATE, data.FIRST_END_HOUR, data.FIRST_END_MIN);
                    if (todayGetTime > firstEndDateMil)
                    {

                        apptPassInfo = apptPassInfo
                            + ' '
                            + '<tr>'
                            + ' <td style="font-weight:bold; ">'
                            + ' <span>Not Active</span>'
                            + ' </td>'
                            + ' </tr>'
                    }

                    var start1 = dowBegin1
                        + ', <span>'
                        + firstBeginDate
                        + '</span> '
                        + firstBeginTime;

                    var end1 = dowEnd1
                        + ', <span>'
                        + firstEndDate
                        + '</span> '
                        + firstEndTime;

                    apptPassInfo = apptPassInfo
                        + ' '
                        + '<tr>'
                        + '<tr>'
                        + '<td><span>Start date/time: '
                        + start1
                        + '</span></td>'
                        + '</tr>'

                    if (!urlParam1.startsWith('SU')
                        && !urlParam1.startsWith('S1')
                        && !urlParam1.startsWith('S2')
                        && !urlParam1.startsWith('S3'))
                    {
                        apptPassInfo = apptPassInfo
                            + '<tr>'
                            + '<td><span>End date/time: '
                            + end1
                            + '</span></td>'
                            + '</tr>'

                    }

                }
                else
                {
                    var dowBegin2 = dateConvDate2Weekday(data.SECOND_BEGIN_DATE);
                    var dowEnd2 = dateConvDate2Weekday(data.SECOND_END_DATE);
                    var secondBeginDate = dateConvFormat1(data.SECOND_BEGIN_DATE);
                    var secondEndDate = dateConvFormat1(data.SECOND_END_DATE);
                    var secondBeginTime = timeConv24To12V2PST(data.SECOND_BEGIN_HOUR
                        + ":"
                        + data.SECOND_BEGIN_MIN);
                    var secondEndTime = timeConv24To12V2PST(data.SECOND_END_HOUR
                        + ":"
                        + data.SECOND_END_MIN);

                    var secondEndDateMil = getDateMil(data.SECOND_END_DATE, data.SECOND_END_HOUR, data.SECOND_END_MIN);
                    if (todayGetTime > secondEndDateMil)
                    {

                        apptPassInfo = apptPassInfo
                            + ' '
                            + '<tr>'
                            + ' <td style="font-weight:bold; ">'
                            + ' <span>Not Active</span>'
                            + ' </td>'
                            + ' </tr>'
                    }

                    var start2 = dowBegin2
                        + ', <span>'
                        + secondBeginDate
                        + '</span> '
                        + secondBeginTime;

                    var end2 = dowEnd2
                        + ', <span>'
                        + secondEndDate
                        + '</span> '
                        + secondEndTime;

                    apptPassInfo = apptPassInfo
                        + ' '
                        + '<tr>'
                        + '<tr>'
                        + '<td><span>Start date/time: '
                        + start2
                        + '</span></td>'
                        + '</tr>'

                    if (!urlParam1.startsWith('SU')
                        && !urlParam1.startsWith('S1')
                        && !urlParam1.startsWith('S2')
                        && !urlParam1.startsWith('S3'))
                    {
                        apptPassInfo = apptPassInfo
                            + '<tr>'
                            + '<td><span>End date/time: '
                            + end2
                            + '</span></td>'
                            + '</tr>'

                    }

                }

            }

            if (pass1Exist
                || pass2Exist)
            {
                apptPassInfo = apptPassInfo
                    + '</tbody> </table>';
            }

        });
    }
    addMsgPassInfo(); // need this

    // appointment time popup - must be after appt check
    if ('UN' == urlParam2
        && collegeCode.trim() != 'SS')
    {
        $('#msg-appt-link')
            .click(
                function()
                {
                    if (undefined == apptPassInfo)
                    {
                        $("#dialog-msg").dialog('open');
                        updateTips("<p>An appointment time has not been assigned for you. New incoming students will receive separate notification of appointment times. Continuing and visiting students should call the Registrar's Office at  858-534-3150 to discuss their eligibility for an appointment time.</p>");
                    }
                    else
                    {
                        $("#dialog-msg-appt").dialog('open');
                        updateTips(apptPassInfo);
                    }
                });
    }
    else
    {
        $('#msg-appt-link').remove();
        $('#msg-appt-link-bar').remove();
    }

    // status and appointment error msg - must be after appt check
    wrapperGetMsgStatus(function(data)
    {
        $('#wr-apptmsg-alert-box-id-div').hide();
        var status = data.STATUS;
        var msgAppt = data.MSG_APPT;
        if (undefined != status)
        {
            $("#msg-status").html(status);
        }
        if (undefined == apptPassInfo)
        {
            if (undefined != msgAppt)
            {
                msgAppt = msgAppt.replace(/<br>/gi, '');
                $("#msg-appt-alert").html(msgAppt);
                // alertFromAppt = true;
                $('#wr-apptmsg-alert-box-id-div').show();
            }
        }
    });

    // msgs

    wrapperGetMsgGlobal(function(data)
    {
        if ('NO' == data.DISPLAY)
        {
            return;
        }
        $('#msg-global').empty();
        $('#msg-global').html('* '
            + data.MSG);
    });

    $("#mainpage-select-term").change(function()
    {
        var sTermVal = $("#mainpage-select-term option:selected").val();
        var sSeqId = (sTermVal.split(":::"))[0];
        var sTermCode = (sTermVal.split(":::"))[1];
        getStatusStartMain(sTermCode, sSeqId);
    });

    // status
    var waitlistAble = true;
    var editAble = true;
    var dropAble = true;
    var gotMD = false;

    wrapperCheckStatusWaitlistable(function(data)
    {
        if (undefined != data
            && undefined != data.WAITLIST_ABLE)
        {
            waitlistAble = data.WAITLIST_ABLE;
        }
    });

    if (!isSummerSession3)
    {
        wrapperCheckStatusButton(function(data)
        {
            $.each(data, function(index, entry)
            {
                editAble = entry.EDITABLE;
                dropAble = entry.DROPABLE;
                return false;
            });
        });
    }

    if ('MD' == urlParam2)
    {
        gotMD = true;
    }

    var enrollAddIsTodayFuture = true;
    var enrollAddIsTodayBetween = false;
    wrapperGetEnrollAddDates(function(data)
    {
        // {"START_DATE":"2014-02-12","END_DATE":"2014-04-12"}
        var sd = data.START_DATE;
        var ed = data.END_DATE;
        if (ed != "")
        {
            ed = getDateMil(ed, "23", "59");
            if (todayGetTime <= ed)
            {
                enrollAddIsTodayFuture = false;
            }
            if (sd != "")
            {
                sd = getDateMil(sd, "00", "00");
                if (todayGetTime >= sd
                    && todayGetTime <= ed)
                {
                    enrollAddIsTodayBetween = true;
                }
            }
        }
    });

    // class
    var cGlobData = null;
    var cGlobDataSHList = {};

    function getCopyData(data)
    {
        return JSON.parse(JSON.stringify(data));
    }

    function getClassData()
    {
        if (null != cGlobData)
        {
            cGlobData.length = 0;
            cGlobData = null;
            $.each(cGlobDataSHList, function(index, entry)
            {
                delete entry;
            });
            cGlobDataSHList = {};
        }
        var tmpSched = enrollAddIsTodayFuture ? null : schedCur;

        wrapperGetClass(tmpSched, '', '', function(data)
        {
            cGlobData = data;
        });

        $.each(cGlobData, function(index, entry)
        {
            cGlobDataSHList[entry.SECTION_HEAD] = entry.ENROLL_STATUS;
        });
    }
    getClassData();

    // check for schedule conflicts
    function checkForScheduleConflicts()
    {
        conflictArray = [];
        conflictArray.length = 0;
        var confData = getCopyData(cGlobData);

        // conflict for sched
        $.each(confData, function(i, entry)
        {

            // skip these meeting types
            if (undefined == entry.FK_CDI_INSTR_TYPE
                || entry.FK_CDI_INSTR_TYPE.match(/FI|FM|PB|RE|OT|MU/))
            {
                return;
            }

            var startTime = String("0"
                + entry.BEGIN_HH_TIME).slice(-2)
                + String("0"
                    + entry.BEGIN_MM_TIME).slice(-2);
            var endTime = String("0"
                + entry.END_HH_TIME).slice(-2)
                + String("0"
                    + entry.END_MM_TIME).slice(-2);
            var dayCode = entry.DAY_CODE;
            var iType = entry.FK_CDI_INSTR_TYPE;

            var startDate = String(entry.START_DATE).replace(/\-/g, "");
            var endDate = String(entry.END_DATE).replace(/\-/g, "");

            // if TBA then skip
            if (startTime.toString().match(/^0+$/)
                || startDate.toString().match(/TBA/i))
            {
                return;
            }

            $.each(confData.slice(i + 1), function(j, entry2)
            {

                // skip these types

                if (undefined == entry2.FK_CDI_INSTR_TYPE
                    || entry2.FK_CDI_INSTR_TYPE.match(/FI|FM|PB|RE|OT|MU/))
                {
                    return;
                }

                var startTime2 = String("0"
                    + entry2.BEGIN_HH_TIME).slice(-2)
                    + String("0"
                        + entry2.BEGIN_MM_TIME).slice(-2);
                var endTime2 = String("0"
                    + entry2.END_HH_TIME).slice(-2)
                    + String("0"
                        + entry2.END_MM_TIME).slice(-2);
                var dayCode2 = entry2.DAY_CODE;
                var iType2 = entry2.FK_CDI_INSTR_TYPE

                var startDate2 = String(entry2.START_DATE).replace(/\-/g, "");
                var endDate2 = String(entry2.END_DATE).replace(/\-/g, "");

                // if TBA then skip
                if (startTime2.toString().match(/^0+$/)
                    || startDate2.toString().match(/TBA/i))
                {
                    return;
                }

                // if same section then skip -- handles case of two different
                // sections sharing a lecture so the
                // lectures don't conflict (you won't be able to stay enrolled
                // in both anyway)
                if (entry.SECTION_NUMBER == entry2.SECTION_NUMBER)
                {
                    return;
                }

                // if both are midterms then check for specific date +
                // overlapping time
                if ('MI' == iType
                    && 'MI' == iType2)
                {
                    if (startDate == startDate2)
                    {
                        if (startTime < endTime2
                            && startTime2 < endTime)
                        {
                            // midterm conflict
                            addToConflictsArray(entry, entry2);
                            return;
                        }
                    }
                    return;
                }

                // this will take care of MI + other additional meetings
                if (entry.PB_FRIEND
                    && entry2.PB_FRIEND)
                {
                    return;
                }

                // need to also check if just one is a midterm
                if ('MI' == iType
                    || 'MI' == iType2)
                {
                    if (dayCode == dayCode2
                        && startTime < endTime2
                        && startTime2 < endTime)
                    {
                        addToConflictsArray(entry, entry2);
                        return;
                    }
                }

                // after midterms have been checked if either are PB_Friend then
                // skip just to be sure that we're
                // not including additional meetings
                if (entry.PB_FRIEND
                    || entry2.PB_FRIEND)
                {
                    return;
                }

                // else check for day + overlapping time
                if (dayCode == dayCode2
                    && startTime < endTime2
                    && startTime2 < endTime
                    && startDate < endDate2
                    && startDate2 < endDate)
                {
                    addToConflictsArray(entry, entry2);
                    return;
                }

            });
        });

    }
    checkForScheduleConflicts();

    /*
     * Checks for duplicate entry before adding to conflicts.
     */
    function addToConflictsArray(a, b)
    {
        var duplicate = false;
        // if either are midterms then push automatically
        if (a.FK_CDI_INSTR_TYPE == 'MI'
            || b.FK_CDI_INSTR_TYPE == 'MI')
        {

            conflictArray.push([ a, b ]);
            return;
        }
        $.each(conflictArray, function(index, entry)
        {
            // make sure it's not a duplicate
            if (entry[0].SUBJ_CODE == a.SUBJ_CODE
                && entry[0].CRSE_CODE == a.CRSE_CODE
                && entry[0].FK_CDI_INSTR_TYPE != 'MI'
                && entry[1].SUBJ_CODE == b.SUBJ_CODE
                && entry[1].CRSE_CODE == b.CRSE_CODE
                && entry[1].FK_CDI_INSTR_TYPE != 'MI')
            {

                duplicate = true;
                return false;
            }
        });

        if (!duplicate)
        {
            conflictArray.push([ a, b ]);
        }
    }

    function checkForFinalConflicts()
    {
        finalConflictArray = [];
        finalConflictArray.length = 0;
        var confData = getCopyData(cGlobData);

        $.each(confData, function(i, entry)
        {

            // only compare finals
            if (undefined == entry.FK_CDI_INSTR_TYPE
                || entry.FK_CDI_INSTR_TYPE != 'FI')
            {
                return;
            }

            var startTime = String("0"
                + entry.BEGIN_HH_TIME).slice(-2)
                + String("0"
                    + entry.BEGIN_MM_TIME).slice(-2);
            var endTime = String("0"
                + entry.END_HH_TIME).slice(-2)
                + String("0"
                    + entry.END_MM_TIME).slice(-2);
            var startDate = entry.START_DATE;
            var dayCode = entry.DAY_CODE;

            // if TBA then skip
            if (startTime.toString().match(/^0+$/)
                || startDate.toString().match(/TBA/i))
            {
                return;
            }

            $.each(confData.slice(i + 1), function(j, entry2)
            {

                // only compare finals
                if (undefined == entry2.FK_CDI_INSTR_TYPE
                    || entry2.FK_CDI_INSTR_TYPE != 'FI')
                {
                    return;
                }

                var startTime2 = String("0"
                    + entry2.BEGIN_HH_TIME).slice(-2)
                    + String("0"
                        + entry2.BEGIN_MM_TIME).slice(-2);
                var endTime2 = String("0"
                    + entry2.END_HH_TIME).slice(-2)
                    + String("0"
                        + entry2.END_MM_TIME).slice(-2);
                var startDate2 = entry2.START_DATE;
                var dayCode2 = entry2.DAY_CODE;
                var iType2 = entry2.FK_CDI_INSTR_TYPE

                // if TBA then skip
                if (startTime2.toString().match(/^0+$/)
                    || startDate2.toString().match(/TBA/i))
                {
                    return;
                }

                // if same section then skip -- handles case of two different
                // sections sharing a lecture so the
                // finals don't conflict (you won't be able to stay enrolled in
                // both anyway)
                if (entry.SECTION_NUMBER == entry2.SECTION_NUMBER)
                {
                    return;
                }

                // else check for day + overlapping time
                if (startDate == startDate2
                    && startTime < endTime2
                    && startTime2 < endTime)
                {
                    finalConflictArray.push([ entry, entry2 ]);
                    return;
                }

            });
        });
    }
    checkForFinalConflicts();

    // preauth link
    if (undefined != preauthData
        && null != preauthData)
    {
        preauthData.length = 0;
    }
    var preauthData = [];
    wrapperGetPreauthInfo(function(data)
    {
        if ('YES' == data.DISPLAY)
        {
            $.each(data.LIST_DATA, function(index, entry)
            {
                var pSubjCode = entry.SUBJ_CODE;
                var pCrseCode = entry.CRSE_CODE;
                var pSectNum = entry.SECTION_NUMBER;
                var orType1 = entry.OVERRIDE_TYPE_1;
                var orType2 = entry.OVERRIDE_TYPE_2;
                var orType3 = entry.OVERRIDE_TYPE_3;

                preauthData.push({
                    'SUBJ_CODE' : pSubjCode, 'CRSE_CODE' : pCrseCode, 'SECTION_NUMBER' : pSectNum, // can be undefined
                    'OVERRIDE_TYPE_1' : orType1, 'OVERRIDE_TYPE_2' : orType2, 'OVERRIDE_TYPE_3' : orType3
                });
            });
        }
    });
    updatePreAuthLinks();

    // schedule
    var schedList = [];
    schedList.length = 0;
    $("#my-schedule-id").val('my-schedule-opt-dummy');
    $('#my-schedule-label').text(schedDefault);
    function getSchednames()
    {
        schedList = [];
        schedList.length = 0;

        wrapperGetSchednames(function(data)
        {
            schedList.push(schedDefault);
            // var reTmp = new RegExp( "^\\s*" + schedDefault + "\\s*$" , "i" );

            $.each(data, function(index, entry)
            {
                if (entry == schedDefault)
                {
                    // if ( entry.match( reTmp ) ) {
                    return;
                }
                schedList.push(entry);
            });
        });
    }
    getSchednames();

    function schedDropdownReload()
    {

        $("#my-schedule-opt-dummy").prop('disabled', true);

        getSchednames();
        $(".sched-class-x").remove();
        $.each(schedList, function(i, entry)
        {

            if (gotMD
                || got56
                || enrollAddIsTodayFuture)
            {
                if (0 == i)
                {
                    $("#schedid-0").prop('disabled', true);
                    if (gotMD)
                    {
                        $("#schedid-0").attr('title', 'Not for MD students');
                    }
                    else if (got56)
                    {
                        $("#schedid-0").attr('title', 'Hold error');
                    }
                    else if (enrollAddIsTodayFuture)
                    {
                        $("#schedid-0").attr('title', 'Inactive at this time');
                    }
                }
                else
                {
                    $("<option disabled class='sched-class-all sched-class-x' id='schedid-"
                        + i
                        + "' value='schedval-"
                        + i
                        + "' >"
                        + entry
                        + "</option>").appendTo("#my-schedule-id");
                }
                return; // no handler needed
            }

            if (0 != i)
            {
                $("<option class='sched-class-all sched-class-x' id='schedid-"
                    + i
                    + "' value='schedval-"
                    + i
                    + "' >"
                    + entry
                    + "</option>").appendTo("#my-schedule-id");
            }

        });

        if (gotMD
            || got56
            || enrollAddIsTodayFuture)
        { // disable all actions
            $(".my-schedule-action-class").prop('disabled', true);
            if (gotMD)
            {
                $("#schedid-0").attr('title', 'Not for MD students');
            }
            else if (got56)
            {
                $(".my-schedule-action-class").attr('title', 'Hold error');
            }
            else if (enrollAddIsTodayFuture)
            {
                $(".my-schedule-action-class").attr('title', 'Inactive at this time');
            }
        }
        else
        {
            if (schedCur == schedDefault)
            {
                $("#my-schedule-opt-rename").prop('disabled', true);
                $("#my-schedule-opt-delete").prop('disabled', true);
            }
            else
            {
                $("#my-schedule-opt-rename").prop('disabled', false);
                $("#my-schedule-opt-delete").prop('disabled', false);
            }
        }

        $("#my-schedule-id option:disabled").css('color', 'gray');
        $("#my-schedule-id option:enabled").css('color', 'black');

        $("#my-schedule-id option").mouseleave(function(e)
        {
            $("#my-schedule-opt-dummy").prop("selected", true);
        });
        ;

        $("#my-schedule-id").change(function()
        {

            var thisId = $(this).children(":selected").attr("id").trim();
            var thisText = $(this).children(":selected").text().trim();
            var thisClass = $(this).children(":selected").attr("class");

            if (undefined != thisClass
                && thisClass.match(/sched-class-all/))
            {
                // non-command schedules

                schedCur = thisText;

                $('#my-schedule-label').text(schedCur);
                $("#my-schedule-id").val('my-schedule-opt-dummy');

                schedDropdownReload();
                rebuildTabs();

                $("#my-schedule-opt-dummy").prop('selected', 'selected');

                if (sGridObj[0].grid)
                {
                    if (prevQuery != undefined)
                    {
                        prevQuery();
                    }
                    searchLoadGridPage(0, false, true); // shced change affect
                    // plans in search grid
                }

            }
            else if ("my-schedule-opt-new" == thisId)
            {
                $("#my-schedule-opt-dummy").prop('selected', 'selected');

                var schedTotal = schedList.length;

                if (schedTotal > 19)
                {
                    $("#dialog-msg").dialog('open')
                    var tipsMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>The maximum number of schedules is 20.</span></div>";
                    updateTips(tipsMsg);
                    return;

                }

                $("#dialog-schedule-input").dialog('open');
                $('#dialog-schedule-input-t1-i1').val('');
                $("#dialog-schedule-input").dialog('option', 'action', 'create');
                $('#dialog-schedule-input-confirm').button('option', 'label', 'Create');
                updateTips("<b>Create a schedule</b>");

            }
            else if ("my-schedule-opt-rename" == thisId)
            {
                $("#my-schedule-opt-dummy").prop('selected', 'selected');

                if (schedCur == schedDefault)
                {
                    $("#dialog-msg").dialog('open')
                    var tipsMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Cannot rename the primary schedule.</span></div>";
                    updateTips(tipsMsg);
                    return;
                }

                $("#dialog-schedule-input").dialog('open');
                $('#dialog-schedule-input-t1-i1').val('');
                $("#dialog-schedule-input").dialog('option', 'action', 'rename');
                $('#dialog-schedule-input-confirm').button('option', 'label', 'Rename');
                updateTips("<b>Rename \""
                    + schedCur
                    + "\" </b> - Enter new schedule name.");

            }
            else if ("my-schedule-opt-copy" == thisId)
            {
                $("#my-schedule-opt-dummy").prop('selected', 'selected');

                $("#dialog-schedule-input").dialog('open');
                $('#dialog-schedule-input-t1-i1').val('');
                $("#dialog-schedule-input").dialog('option', 'action', 'copy');
                $('#dialog-schedule-input-confirm').button('option', 'label', 'Copy');
                updateTips("<b>Copy \""
                    + schedCur
                    + "\" </b> - Enter new schedule name.");

            }
            else if ("my-schedule-opt-delete" == thisId)
            {
                $("#my-schedule-opt-dummy").prop('selected', 'selected');

                if (schedCur == schedDefault)
                {
                    $("#dialog-msg").dialog('open')
                    var tipsMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Cannot delete the primary schedule.</span></div>";
                    updateTips(tipsMsg);
                    return;
                }

                var $diagObj = $("#dialog-schedule-confirm").dialog('open');
                updateTips("<b>Are you sure you want to delete \""
                    + schedCur
                    + "\"?</b>");

            }

        });

    }
    schedDropdownReload();

    $("#dialog-schedule-confirm").dialog({
        autoOpen : false, maxWidth : 800, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 800, modal : true, closeOnEscape : false, buttons : {
            Cancel : {
                text : "Cancel", click : function()
                {
                    clearAppendTips();
                    $(this).dialog("close");
                }
            }, Confirm : {
                text : "Delete", title : "Delete schedule", click : function()
                {
                    clearAppendTips();
                    $(this).dialog("close");
                    wrapperSchedRemove(schedCur, function(data)
                    {

                        if ('SUCCESS' == data.OPS)
                        {
                            schedDropdownReload();
                            $('#schedid-0').prop('selected', true).trigger('change');
                            $('#my-schedule-label').text(schedDefault);

                        }
                        else
                        {
                            var reason = "";
                            if (undefined != data.REASON
                                || "null" != data.REASON)
                            {
                                reason = data.REASON;
                            }
                            var tipsMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>The current schedule \""
                                + schedCur
                                + "\" was not removed.  "
                                + reason
                                + "</span></div>";

                            var $tmpDiag = $("#dialog-after-action").dialog('open');
                            var tmpArr = dialogAfterActionBut.slice(0);
                            tmpArr.splice(1, 2); // no email = No actionevent
                            $tmpDiag.dialog('option', 'buttons', tmpArr);
                            updateTips(tipsMsg);
                        }
                    });

                }

            }

        }
    });

    $("#dialog-schedule-input").dialog({
        autoOpen : false, maxWidth : 800, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 800, modal : true, closeOnEscape : false, open : function()
        {
            $('#dialog-schedule-input-t1-i1').prop('disabled', false);
        }, buttons : {
            Cancel : {
                text : "Cancel", click : function()
                {
                    clearAppendTips();
                    $(this).dialog("close");
                }
            }, Confirm : {
                id : "dialog-schedule-input-confirm", click : function()
                {
                    clearAppendTips();

                    var $nameObj = $('#dialog-schedule-input-t1-i1');
                    var schedName = $nameObj.val().trim();

                    var action = $(this).dialog('option', 'action');
                    var stop = false;
                    var replaceAction = false;

                    if ("Replace" == $('#dialog-schedule-input-confirm').button('option', 'label'))
                    {

                        replaceAction = true;

                    }
                    else if ("create" == action
                        || "rename" == action
                        || "copy" == action)
                    {

                        if (schedName.match(/^\s*$/))
                        {
                            updateTips2("<div class='msg error'>Please provide a schedule name</div>");
                            stop = true;
                            return false;
                        }

                        // don't allow this action with the name of the
                        // currently selected schedule
                        // var currentScheduleRE = new RegExp( '^\\s*' +
                        // schedCur + '\\s*$' , 'i' );
                        if (schedName == schedCur)
                        {

                            updateTips2("<div class='msg error'>You cannot perform this action using the same name as the currently selected schedule!</div>");
                            stop = true;
                            return false;
                        }

                        var schedExist = false;
                        // var reTmp = new RegExp( '^\\s*' + schedDefault +
                        // '\\s*$' , 'i' ); //case inseinsitive

                        if (schedName == schedDefault)
                        {
                            // if ( schedName.match( reTmp ) ) {
                            schedExist = true;
                        }
                        else
                        {
                            // reTmp = new RegExp( '^\\s*' + schedName + '\\s*$'
                            // );
                            $.each(schedList, function(index, entry)
                            {
                                if (entry == schedName)
                                {
                                    // if ( entry.match( reTmp ) ) {
                                    schedExist = true;
                                    return false;
                                }
                            });
                        }

                        if (schedExist)
                        {
                            updateTips2("<div class='msg alert'>\""
                                + schedName
                                + "\" already exists. Would you like to replace \""
                                + schedName
                                + "\"?</div>");
                            $nameObj.prop('disabled', true);
                            $('#dialog-schedule-input-confirm').button('option', 'label', 'Replace');
                            stop = true;
                        }
                    }

                    if (stop)
                    {
                        return;
                    }

                    // schedDefualt must be case insensitive
                    // var reTmp = new RegExp( '^\\s*' + schedDefault + '\\s*$',
                    // "i" );
                    if (schedName == schedDefault)
                    {
                        // if ( schedName.match( reTmp ) ) {

                        schedName = schedDefault;
                    }

                    if (replaceAction)
                    { // just delete the target

                        wrapperSchedRemove(schedName, function(data)
                        {

                            if ('SUCCESS' != data.OPS)
                            {
                                var reason = "";
                                if (undefined != data.REASON
                                    || "null" != data.REASON)
                                {
                                    reason = data.REASON;
                                }
                                var tipsMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Schedule\""
                                    + schedName
                                    + "\" could not be replaced.  "
                                    + reason
                                    + "</span></div>";

                                var $tmpDiag = $("#dialog-after-action").dialog('open');
                                var tmpArr = dialogAfterActionBut.slice(0);
                                tmpArr.splice(1, 2); // no email = No
                                // actionevent
                                $tmpDiag.dialog('option', 'buttons', tmpArr);
                                updateTips(tipsMsg);
                            }
                        });
                    }

                    if ("create" == action)
                    {

                        clearAppendTips();

                        wrapperPlanAdd(schedName, 'NONE', 'NONE', 0, 'XX', 'X', 0, function(data)
                        {

                            if ('SUCCESS' == data.OPS)
                            {

                                schedDropdownReload();

                                // load new schedule
                                var tmp = 0;
                                // var reTmp = new RegExp( '^\\s*' + schedName +
                                // '\\s*$' );
                                $.each(schedList, function(index, entry)
                                {
                                    if (entry == schedName)
                                    {
                                        // if ( entry.match( reTmp ) ) {
                                        tmp = index; // index of schedName;
                                        return false;
                                    }
                                });

                                $('#schedid-'
                                    + tmp).prop('selected', true).trigger('change');
                                $('#my-schedule-label').text(schedName);

                            }
                            else
                            {
                                var reason = "";
                                if (undefined != data.REASON
                                    || "null" != data.REASON)
                                {
                                    reason = data.REASON;
                                }
                                var tipsMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>New schedule \""
                                    + schedName
                                    + "\" was not created.  "
                                    + reason
                                    + "</span></div>";
                                var $tmpDiag = $("#dialog-after-action").dialog('open');
                                var tmpArr = dialogAfterActionBut.slice(0);
                                tmpArr.splice(1, 2); // no email = No
                                // actionevent
                                $tmpDiag.dialog('option', 'buttons', tmpArr);
                                updateTips(tipsMsg);
                            }
                        });

                    }
                    else if ("rename" == action)
                    {

                        clearAppendTips();
                        var oldSchedName = schedCur.trim();

                        wrapperPlanRename(oldSchedName, schedName, function(data)
                        {

                            if ('SUCCESS' == data.OPS)
                            {

                                schedDropdownReload();

                                // load new schedule
                                var tmp = 0;
                                // var reTmp = new RegExp( '^\\s*' + schedName +
                                // '\\s*$' );
                                $.each(schedList, function(index, entry)
                                {

                                    if (entry == schedName)
                                    {
                                        // if ( entry.match( reTmp ) ) {
                                        tmp = index; // index of schedName;
                                        return false;
                                    }
                                });

                                $('#schedid-'
                                    + tmp).prop('selected', true).trigger('change');
                                $('#my-schedule-label').text(schedName);

                            }
                            else
                            {
                                var reason = "";
                                if (undefined != data.REASON
                                    || "null" != data.REASON)
                                {
                                    reason = data.REASON;
                                }
                                var tipsMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Schedule \""
                                    + oldSchedName
                                    + "\" has not been renamed.  "
                                    + reason
                                    + "</span></div>";
                                var $tmpDiag = $("#dialog-after-action").dialog('open');
                                var tmpArr = dialogAfterActionBut.slice(0);
                                tmpArr.splice(1, 2); // no email = No
                                // actionevent
                                $tmpDiag.dialog('option', 'buttons', tmpArr);
                                updateTips(tipsMsg);
                            }

                        }); // rename

                    }
                    else if ("copy" == action)
                    {

                        var tipMsg = "";
                        clearAppendTips();
                        var oldSchedName = schedCur.trim();
                        var sourceExist = false;

                        if (oldSchedName == schedDefault)
                        {
                            wrapperPlanCount(oldSchedName, function(data)
                            {
                                if (undefined != data.COUNT
                                    && data.COUNT > 0)
                                {
                                    sourceExist = true;
                                }
                            });
                        }
                        else
                        {
                            sourceExist = true;
                        }

                        if (!sourceExist)
                        { // no plan -> no schedule in db -> create
                            // oldSchedName first
                            wrapperPlanAdd(oldSchedName, 'NONE', 'NONE', 0, 'XX', 'X', 0, function(data)
                            {
                                if ('SUCCESS' == data.OPS)
                                {
                                    sourceExist = true;
                                }
                                else
                                {
                                    var reason = "";
                                    if (undefined != data.REASON
                                        || "null" != data.REASON)
                                    {
                                        reason = data.REASON;
                                    }
                                    tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Schedule \""
                                        + oldSchedName
                                        + "\" has not been copied.  "
                                        + reason
                                        + "</span></div>";
                                }
                            });
                        }
                        if (sourceExist)
                        {

                            wrapperPlanCopy(oldSchedName, schedName, function(data)
                            {

                                if ('SUCCESS' == data.OPS)
                                {

                                    schedDropdownReload();

                                    // load new schedule
                                    var tmp = 0;
                                    // var reTmp = new RegExp( '^\\s*' +
                                    // schedName + '\\s*$' );
                                    $.each(schedList, function(index, entry)
                                    {

                                        if (entry == schedName)
                                        {
                                            // if ( entry.match( reTmp ) ) {
                                            tmp = index; // index of
                                            // schedName;
                                            return false;
                                        }
                                    });

                                    $('#schedid-'
                                        + tmp).prop('selected', true).trigger('change');
                                    $('#my-schedule-label').text(schedName);

                                }
                                else
                                {
                                    var reason = "";
                                    if (undefined != data.REASON
                                        || "null" != data.REASON)
                                    {
                                        reason = data.REASON;
                                    }
                                    tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Schedule \""
                                        + oldSchedName
                                        + "\" has not been copied.  "
                                        + reason
                                        + "</span></div>";
                                    var $tmpDiag = $("#dialog-after-action").dialog('open');
                                    var tmpArr = dialogAfterActionBut.slice(0);
                                    tmpArr.splice(1, 2); // no email = No
                                    // actionevent
                                    $tmpDiag.dialog('option', 'buttons', tmpArr);
                                    updateTips(tipMsg);
                                }

                            });
                        }

                    } // copy
                    $(this).dialog("close");
                }

            }
        }
    });

    // event --------------------------------------------------------

    loadAeEventArr();
    function checkInputLength(o, n, min, max)
    {
        // o = input object,
        // n = input field name
        // return true or false
        if (0 == o.val().trim().length)
        {
            updateTips2("<div class='msg error'>Event Name Required</div>");
            return false;
        }

        if (o.val().length > max
            || o.val().length < min)
        {
            updateTips2("<div class='msg error'>Event Name cannot exceed "
                + n
                + " characters</div>");
            return false;

        }
        else
        {
            return true;
        }
    }

    function checkDays(dayFields)
    {
        // check if at least one day is selected
        // return true or false
        if (dayFields[0].is(':checked')
            || dayFields[1].is(':checked')
            || dayFields[2].is(':checked')
            || dayFields[3].is(':checked')
            || dayFields[4].is(':checked')
            || dayFields[5].is(':checked')
            || dayFields[6].is(':checked'))
        {
            return true;
        }
        else
        {
            updateTips2("<div class='msg error'>Event Day(s) Required</div>");
            return false;
        }
    }

    function checkTime(start, end)
    {
        // return true or false

        if (!start.val()
            || 'none' == start.val())
        {
            updateTips2("<div class='msg error'>Start and End Time Required</div>");
            return 1;
        }
        else if (!end.val()
            || 'none' == end.val())
        {
            updateTips2("<div class='msg error'>Start and End Time Required</div>");
            return 2;
        }
        else
        {
            var startTime = timeConv12To24(start.val());
            var endTime = timeConv12To24(end.val());
            if (startTime >= endTime)
            {
                updateTips2("<div class='msg error'>Start time must be before end time</div>");
                return 3;
            }

            return 0;

        }
    }

    function loadAeEventArr()
    {
        aeEventArr = [];
        aeEventArr.length = 0;
        wrapperEventGet(function(data)
        {
            aeEventArr = data;
        });
    }

    function eventRemoveFun(classObj)
    {

        var aeName = classObj.data.aeName;
        var aeDay = classObj.data.aeDay;
        var aeDays = classObj.data.aeDays;
        var aeLocation = classObj.data.aeLocation;
        var aeStartTime = classObj.data.aeStartTime;
        var aeEndTime = classObj.data.aeEndTime;
        var aeTimeStamp = classObj.data.aeTimeStamp;

        // get values from calendar - aeName, aeDays, aeStartTime, aeEndTIme,
        // aeLocation
        // save it as old diag values
        // populate diag with old diag values

        // confirm:
        // get new diag values
        // remove events from old diag values
        // create events from new diag values.

        var $diagObj = $("#dialog-event").dialog('open');
        $diagObj.dialog('option', 'action', 'remove');
        $diagObj.dialog('option', 'aetimestamp', aeTimeStamp);
        $("#dialog-event-confirm").button('option', 'label', 'Remove');

        // initialize
        $('#dialog-event-t1-i1').val(aeName);

        // days -----------------
        var daysArr = aeDays.split('');
        for (var i = 0; i < daysArr.length; i++)
        {
            var j = i + 1;
            if ('1' == daysArr[i])
            {
                $('#dialog-event-t2-c'
                    + j).prop('checked', true);
            }
            else
            {
                $('#dialog-event-t2-c'
                    + j).prop('checked', false);
            }
        }

        // start/end
        $('#dialog-event-t3-i1').timepicker(tpOptionsEvents);
        $('#dialog-event-t3-i1').timepicker('setTime', new Date(today_y, today_m, today_d, aeStartTime.substr(0, 2), aeStartTime.substr(2, 2)));

        $('#dialog-event-t3-i2').timepicker(tpOptionsEvents);
        $('#dialog-event-t3-i2').timepicker('setTime', new Date(today_y, today_m, today_d, aeEndTime.substr(0, 2), aeEndTime.substr(2, 2)));

        // location
        $('#dialog-event-t4-i1').val(aeLocation);
        disableEventDialog();
        updateTips("<b>Remove Event</b>");
        clearAppendTips();

    }
    ;

    function disableEventDialog()
    {
        $("#dialog-event-t1-label").removeClass("wr-required-class");
        $("#dialog-event-t2-label").removeClass("wr-required-class");
        $("#dialog-event-t3-label-1").removeClass("wr-required-class");
        $("#dialog-event-t3-label-2").removeClass("wr-required-class");
        $('#dialog-event-t1-i1').prop('disabled', true);
        for (var i = 1; i < 8; i++)
        {
            $('#dialog-event-t2-c'
                + i).prop('disabled', true);
        }
        $('#dialog-event-t3  select.ui-timepicker-select').prop('disabled', true);
        $('#dialog-event-t4-i1').prop('disabled', true);
    }

    function enableEventDialog()
    {
        $("#dialog-event-t1-label").addClass("wr-required-class");
        $("#dialog-event-t2-label").addClass("wr-required-class");
        $("#dialog-event-t3-label-1").addClass("wr-required-class");
        $("#dialog-event-t3-label-2").addClass("wr-required-class");
        $('#dialog-event-t1-i1').prop('disabled', false);
        for (var i = 1; i < 8; i++)
        {
            $('#dialog-event-t2-c'
                + i).prop('disabled', false);
        }
        $('#dialog-event-t3  select.ui-timepicker-select').prop('disabled', false);
        $('#dialog-event-t4-i1').prop('disabled', false);
    }

    function eventEditFun(classObj)
    {

        var aeName = classObj.data.aeName;
        var aeDay = classObj.data.aeDay;
        var aeDays = classObj.data.aeDays;
        var aeLocation = classObj.data.aeLocation;
        var aeStartTime = classObj.data.aeStartTime;
        var aeEndTime = classObj.data.aeEndTime;
        var aeTimeStamp = classObj.data.aeTimeStamp;

        var $diagObj = $("#dialog-event").dialog('open');
        $diagObj.dialog('option', 'action', 'edit');
        $diagObj.dialog('option', 'aetimestamp', aeTimeStamp);
        $("#dialog-event-confirm").button('option', 'label', 'Edit');

        // initialize
        $('#dialog-event-t1-i1').val(aeName);

        // days -----------------
        var daysArr = aeDays.split('');
        for (var i = 0; i < daysArr.length; i++)
        {
            var j = i + 1;
            if ('1' == daysArr[i])
            {
                $('#dialog-event-t2-c'
                    + j).prop('checked', true);
            }
            else
            {
                $('#dialog-event-t2-c'
                    + j).prop('checked', false);
            }
        }

        // start/end
        $('#dialog-event-t3-i1').timepicker(tpOptionsEvents);
        $('#dialog-event-t3-i1').timepicker('setTime', new Date(today_y, today_m, today_d, aeStartTime.substr(0, 2), aeStartTime.substr(2, 2)));

        $('#dialog-event-t3-i2').timepicker(tpOptionsEvents);
        $('#dialog-event-t3-i2').timepicker('setTime', new Date(today_y, today_m, today_d, aeEndTime.substr(0, 2), aeEndTime.substr(2, 2)));

        // location
        $('#dialog-event-t4-i1').val(aeLocation);

        enableEventDialog();
        updateTips("<b>Edit Event</b>");
        clearAppendTips();
    }
    ;

    if (got56)
    {
        $('#add-event-id').button().button('disable');
        $('#add-event-id').attr('title', 'Hold error');
    }
    else
    {
        $('#add-event-id').click(function()
        {

            var $diagObj = $("#dialog-event").dialog('open');
            $diagObj.dialog('option', 'action', 'create');
            $("#dialog-event-confirm").button('option', 'label', 'Add');

            // initialize
            $('#dialog-event-t1-i1').val('');
            $(".dialog-event-days-class").prop('checked', false);
            $('#dialog-event-t3-i1').val('');
            $('#dialog-event-t3-i2').val('');
            $('#dialog-event-t4-i1').val('');

            // time picker
            $('#dialog-event-t3-i1').timepicker(tpOptionsEvents);
            $('#dialog-event-t3-i2').timepicker(tpOptionsEvents);

            enableEventDialog();
            updateTips("<b>Add Event</b>");
            clearAppendTips();

        });
    }

    /*
     * Dialog for events. Handles add, change and remove.
     */
    $("#dialog-event").dialog({
        autoOpen : false, maxWidth : 800, position : {
            my : "center", at : "center", of : window
        }, height : 'auto', width : 800, modal : true, closeOnEscape : false, buttons : {

            Cancel : {
                text : "Cancel", click : function()
                {
                    clearAppendTips();
                    $(this).dialog("close");
                }
            },

            Confirm : {
                id : "dialog-event-confirm", click : function()
                {
                    clearAppendTips();

                    var action = $(this).dialog('option', 'action');
                    var aeTimeStamp = $(this).dialog('option', 'aetimestamp', aeTimeStamp);

                    // name
                    var name = $('#dialog-event-t1-i1');
                    if (!checkInputLength(name, "name", 1, 20))
                    {
                        return;
                    }

                    // days
                    var dayFieldsArr = [];
                    dayFieldsArr.length = 0;
                    dayFieldsArr.push($('#dialog-event-t2-c1')); // MON
                    dayFieldsArr.push($('#dialog-event-t2-c2'));
                    dayFieldsArr.push($('#dialog-event-t2-c3'));
                    dayFieldsArr.push($('#dialog-event-t2-c4'));
                    dayFieldsArr.push($('#dialog-event-t2-c5'));
                    dayFieldsArr.push($('#dialog-event-t2-c6'));
                    dayFieldsArr.push($('#dialog-event-t2-c7')); // SUN

                    if (!checkDays(dayFieldsArr))
                    {
                        return;
                    }

                    // start and end
                    var startTime = $('#dialog-event-t3 tbody tr td:nth-child(2) select.ui-timepicker-select');
                    var endTime = $('#dialog-event-t3 tbody tr td:nth-child(4) select.ui-timepicker-select');

                    var checkTimeRet = checkTime(startTime, endTime);
                    if (1 == checkTimeRet)
                    {
                        return;
                    }
                    else if (2 == checkTimeRet)
                    {
                        return;
                    }
                    else if (3 == checkTimeRet)
                    {
                        return;
                    }

                    var aeName = $('#dialog-event-t1-i1').val();

                    // aeDays MON-SUN
                    var aeDays = $('#dialog-event-t2-c1').is(':checked') ? "1" : "0"; // MON
                    aeDays += $('#dialog-event-t2-c2').is(':checked') ? "1" : "0";
                    aeDays += $('#dialog-event-t2-c3').is(':checked') ? "1" : "0";
                    aeDays += $('#dialog-event-t2-c4').is(':checked') ? "1" : "0";
                    aeDays += $('#dialog-event-t2-c5').is(':checked') ? "1" : "0";
                    aeDays += $('#dialog-event-t2-c6').is(':checked') ? "1" : "0"; // SAT
                    aeDays += $('#dialog-event-t2-c7').is(':checked') ? "1" : "0"; // SUN

                    var aeStartTime = timeConv12To24(startTime.val());
                    var aeEndTime = timeConv12To24(endTime.val());

                    var aeLocation = $('#dialog-event-t4-i1').val();
                    if (aeLocation.match(/^\s*$/))
                    {
                        aeLocation = "";
                    }

                    $(this).dialog("close");

                    if ("create" == action)
                    {

                        wrapperEventAdd(aeName, aeDays, aeStartTime, aeEndTime, aeLocation, function(data)
                        {

                            var tipMsg = "";
                            if ('SUCCESS' == data.OPS)
                            {
                                loadAeEventArr();
                                rebuildTabsEventChange();
                                tipMsg = "<div class='msg confirm'><h4>Request Successful</h4><span>New event("
                                    + aeName
                                    + ") added.</span></div>";

                            }
                            else
                            {
                                var reason = "";
                                if (undefined != data.REASON
                                    || "null" != data.REASON)
                                {
                                    reason = data.REASON;
                                }
                                tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>New event("
                                    + aeName
                                    + ") was not created.  "
                                    + reason
                                    + "</span></div>";
                                $("#dialog-msg").dialog('open')
                                updateTips(tipMsg);
                            }

                        });

                    }
                    else if ("remove" == action)
                    {

                        wrapperEventRemove(aeTimeStamp, function(data)
                        {

                            var tipMsg = "";
                            if ('SUCCESS' == data.OPS)
                            {
                                loadAeEventArr();
                                rebuildTabsEventChange();
                                tipMsg = "<div class='msg confirm'><h4>Request Successful</h4><span>Event("
                                    + aeName
                                    + ") removed.</span></div>";

                            }
                            else
                            {
                                var reason = "";
                                if (undefined != data.REASON
                                    || "null" != data.REASON)
                                {
                                    reason = data.REASON;
                                }
                                tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Event("
                                    + aeName
                                    + ") was not removed.  "
                                    + reason
                                    + "</span></div>";
                                $("#dialog-msg").dialog('open')
                                updateTips(tipMsg);
                            }
                        });
                    }
                    else if ("edit" == action)
                    {
                        wrapperEventEdit(aeTimeStamp, aeName, aeDays, aeStartTime, aeEndTime, aeLocation, function(data)
                        {

                            if ('SUCCESS' == data.OPS)
                            {
                                loadAeEventArr();
                                rebuildTabsEventChange();
                            }
                            else
                            {
                                var reason = "";
                                if (undefined != data.REASON
                                    || "null" != data.REASON)
                                {
                                    reason = data.REASON;
                                }
                                var tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Event("
                                    + aeName
                                    + ") was not updated.  "
                                    + reason
                                    + "</span></div>";
                                $("#dialog-msg").dialog('open')
                                updateTips(tipMsg);
                            }
                        });
                    }
                }
            }

        }
    });

    // list(grid) ----------------------------------------------------------

    // also used by calendar
    var planSectNumEnrollDetail = [];
    planSectNumEnrollDetail.length = 0;
    var numButtonEnrollRows = 0;
    var cLocalDataPBF = [];
    cLocalDataPBF.length = 0;

    /*
     * These TT functions are used by jqgrid to add titles to columns.
     */
    function gridTTBuilding(rowId, cellVal, rawObject)
    {
        if (undefined == cellVal
            || "" == cellVal.trim()
            || 'TBA' == cellVal)
        {
            return ''
        }
        return 'title="Click for campus map"';
    }

    function gridTTInstType(rowId, cellVal, rawObject)
    {
        return 'title="'
            + convInstType(cellVal)
            + '"';
    }

    function gridTTGrade(rowId, cellVal, rawObject)
    {
        return 'title="'
            + gradeOptionConv(cellVal)
            + '"';
    }

    /*
     * The formatter functions are used by jqgrid to format cells. In this case
     * they make the cell values links to maps.
     */
    function getMapURL(enStatus, buildingVal, cellVal)
    {
        if ('EN' == enStatus)
        {
            return '<a target="_blank" class="nonewwin " href="https://maps.ucsd.edu/?id=1005#!s/'
                + buildingVal.trim()+"_Main?ct/18312"
                + '">'
                + cellVal
                + '</a>';
        }
        else if ('WT' == enStatus)
        {
            return '<a target="_blank" class="nonewwin " href="https://maps.ucsd.edu/?id=1005#!s/'
                + buildingVal.trim()+"_Main?ct/18312"
                + '">'
                + cellVal
                + '</a>';
        }
        else if ('PL' == enStatus)
        {
            return '<a target="_blank" class="nonewwin " href="https://maps.ucsd.edu/?id=1005#!s/'
                + buildingVal.trim()+"_Main?ct/18312"
                + '">'
                + cellVal
                + '</a>';
        }
        else
        {
            return '<a target="_blank" class="nonewwin " href="https://maps.ucsd.edu/?id=1005#!s/'
                + buildingVal.trim()+"_Main?ct/18312"
                + '">'
                + cellVal
                + '</a>';
        }
    }

    function gridMapFormatRoomCellPBF(cellVal, options, rowObject)
    {
        if (undefined == cellVal
            || 'TBA' == cellVal)
        {
            return 'TBA';
        }
        else if('RCLAS' == cellVal.trim())
    	{
    	return 'RCLAS';
    	}
        else if ("" == cellVal.trim())
        {
            return '';
        }

        return getMapURL(rowObject.ENROLL_STATUS, rowObject.PBF_BLDG, cellVal);
    }

    function gridMapFormatRoomCell(cellVal, options, rowObject)
    {
        if (undefined == cellVal
            || 'TBA' == cellVal)
        {
            return 'TBA';
        }
        else if('RCLAS' == cellVal.trim())
    	{
    	return 'RCLAS';
    	}
        else if ("" == cellVal.trim())
        {
            return '';
        }

        return getMapURL(rowObject.ENROLL_STATUS, rowObject.BLDG_CODE, cellVal);
    }

    function gridMapFormat(cellVal, options, rowObject)
    {
        if (undefined == cellVal
            || 'TBA' == cellVal)
        {
            return 'TBA';
        }
        else if('RCLAS' == cellVal.trim())
    	{
    	return 'RCLAS';
    	}
        else if ("" == cellVal.trim())
        {
            return '';
        }

        return getMapURL(rowObject.ENROLL_STATUS, cellVal, cellVal);
    }

    /*
     * Builds the general enrolled classes grid.
     */
    function gridBuildAll()
    {

        cLocalDataPBF = [];
        cLocalDataPBF.length = 0; // important
        $("#list-id-table").jqGrid("clearGridData", true);

        $('#list-id-table').jqGrid(
            {
                datatype : "local",
                height : '100%',
                autowidth : true,
                shrinkToFit : true,
                gridview : true,
                loadonce : true,
                rowNum : 100,
                viewrecords : true,
                cmTemplate : {
                    title : false
                },

                beforeSelectRow : function(rowid, e)
                {
                    return false; // lose focus
                },

                onRightClickRow : function()
                {
                    $("#list-id-table").jqGrid('resetSelection');
                    return false;
                },

                colNames : [
                    'Subject<br \>Course',
                    'Title',
                    'Section<br />Code',
                    'Type',
                    'Instructor',
                    'Grade<br \>Option',
                    'Units',
                    'Days',
                    'Time',
                    'BLDG',
                    'Room',
                    'Status /<br />(Position)',
                    'Action',
                    'SectNum',
                    'SectHead',
                    'GradeEnable',
                    'UnitEnable',
                    'SubjCode',
                    'CrseCode',
                    'StatusOrg',
                    'RowAttr',
                    'pbFriend' ],

                colModel : [
                    {
                        name : 'colsubj', fixed : true, index : 'subjcrse', jsonmap : "NULL", width : 65, align : 'left', editable : false, sortable : false
                    },
                    {
                        name : 'CRSE_TITLE', fixed : true, index : 'title', jsonmap : "CRSE_TITLE", width : 170, align : 'left', editable : false, sortable : false
                    },
                    {
                        name : 'SECT_CODE', fixed : true, index : 'sectionnumber', jsonmap : "SECT_CODE", width : 41, align : 'center', editable : false, sortable : false
                    },
                    {
                        name : 'FK_CDI_INSTR_TYPE',
                        fixed : true,
                        index : 'type',
                        jsonmap : "FK_CDI_INSTR_TYPE",
                        width : 27,
                        align : 'center',
                        editable : false,
                        sortable : false,
                        title : true,
                        cellattr : gridTTInstType
                    },
                    {
                        name : 'PERSON_FULL_NAME', fixed : true, index : 'inst', jsonmap : "NULL", width : 110, align : 'left', editable : false, sortable : false
                    },
                    {
                        name : 'GRADE_OPTION',
                        fixed : true,
                        index : 'grade',
                        jsonmap : "GRADE_OPTION",
                        width : 40,
                        align : 'center',
                        editable : false,
                        sortable : false,
                        title : true,
                        cellattr : gridTTGrade
                    },
                    {
                        name : 'SECT_CREDIT_HRS', fixed : true, index : 'units', jsonmap : "SECT_CREDIT_HRS", width : 30, align : 'center', editable : false, sortable : false
                    },
                    {
                        name : 'DAY_CODE', fixed : true, index : 'days', jsonmap : "DAY_CODE", width : 85, align : 'center', editable : false, sortable : false
                    },
                    {
                        name : 'coltime', fixed : true, index : 'time', jsonmap : "NULL", width : 80, align : 'center', editable : false, sortable : false
                    },
                    {
                        name : 'BLDG_CODE',
                        fixed : true,
                        index : 'bld',
                        jsonmap : "NULL",
                        width : 40,
                        align : 'center',
                        editable : false,
                        sortable : false,
                        formatter : gridMapFormat,
                        cellattr : gridTTBuilding
                    },
                    {
                        name : 'ROOM_CODE',
                        fixed : true,
                        index : 'rm',
                        jsonmap : "NULL",
                        width : 36,
                        align : 'center',
                        editable : false,
                        sortable : false,
                        formatter : gridMapFormatRoomCell,
                        cellattr : gridTTBuilding
                    },
                    {
                        name : 'colstatus', fixed : true, index : 'status', jsonmap : "NULL", width : 62, align : 'center', editable : false, sortable : false
                    },
                    {
                        name : 'colaction', fixed : true, index : 'action', jsonmap : "action", width : 110, align : 'center', editable : false, sortable : false
                    },
                    {
                        name : 'SECTION_NUMBER', hidden : true, jsonmap : "SECTION_NUMBER"
                    },
                    {
                        name : 'SECTION_HEAD', hidden : true, jsonmap : "SECTION_HEAD"
                    },
                    {
                        name : 'GRADE_OPTN_CD_PLUS', hidden : true, jsonmap : 'GRADE_OPTN_CD_PLUS'
                    },
                    {
                        name : 'SECT_CREDIT_HRS_PL', hidden : true, jsonmap : 'SECT_CREDIT_HRS_PL'
                    },
                    {
                        name : 'SUBJ_CODE', hidden : true, jsonmap : "SUBJ_CODE"
                    },
                    {
                        name : 'CRSE_CODE', hidden : true, jsonmap : "CRSE_CODE"
                    },
                    {
                        name : 'colstatusorg', hidden : true, jsonmap : "NULL"
                    },
                    {
                        name : 'ROW_ATTR', hidden : true
                    },
                    {
                        name : 'PB_FRIEND', hidden : true
                    } ],

                rowattr : function(rd)
                {
                    var res = '';
                    var attr = rd.ROW_ATTR;

                    if (undefined != attr)
                    {
                        if (undefined != rd.ROW_ATTR.rowClass)
                        {
                            res = {
                                "class" : rd.ROW_ATTR.rowClass
                            };
                        }
                    }
                    return res;
                }

            });

        var cLocalData0 = getCopyData(cGlobData);
        var gridObj = $("#list-id-table");

        // merge data
        var cLocalData = [];
        var prevObj = undefined;
        var accuDays = "";
        //
        // combines day codes
        //
        $.each(cLocalData0, function(index, entry)
        {
            if (index == 0)
            { // first
                if (1 == cLocalData0.length)
                {
                    cLocalData.push(entry);
                }
                else
                {
                    prevObj = $.extend(true, {}, entry);
                    accuDays = entry.DAY_CODE;
                }
                return;
            }
            if (prevObj != undefined)
            {
                if (prevObj.SUBJ_CODE == entry.SUBJ_CODE
                    && prevObj.CRSE_CODE == entry.CRSE_CODE
                    && prevObj.SECT_CODE == entry.SECT_CODE
                    && prevObj.START_DATE == entry.START_DATE
                    && prevObj.BEGIN_HH_TIME == entry.BEGIN_HH_TIME
                    && prevObj.BEGIN_MM_TIME == entry.BEGIN_MM_TIME
                    && prevObj.END_HH_TIME == entry.END_HH_TIME
                    && prevObj.END_MM_TIME == entry.END_MM_TIME
                    && prevObj.BLDG_CODE == entry.BLDG_CODE
                    && prevObj.ROOM_CODE == entry.ROOM_CODE
                    && prevObj.SECTION_NUMBER == entry.SECTION_NUMBER
                    && prevObj.ENROLL_STATUS == entry.ENROLL_STATUS)
                {
                    var tmp = entry.DAY_CODE;
                    entry.DAY_CODE = accuDays
                        + entry.DAY_CODE;
                    accuDays = accuDays
                        + tmp;
                }
                else
                { // found new group ==> flush upto prev
                    accuDays = entry.DAY_CODE;
                    cLocalData.push(prevObj);
                }
            }

            // At this point, entry contains accuDays and current
            if ((index + 1) == cLocalData0.length)
            { // last ==> flush buffer including current
                cLocalData.push(entry);
            }
            prevObj = $.extend(true, {}, entry);

        }); // each
        cLocalData0.length = 0;
        cLocalData0 = null; // release

        var newRowData = [];
        newRowData.length = 0;

        var gridZeroObj = undefined;
        var preEntry = null;
        var preEnStatus = "";
        var preSubjCrse = "";
        var preSectHead = "";
        var preSectChar = "";
        var isDupGroup = false;
        var sHSN = "";
        $.each(cLocalData, function(index, entry)
        {

            var isEntry00 = ('00' == entry.SECT_CODE.slice(-2)) ? true : false;

            // couple grid
            if ('LE' == entry.FK_CDI_INSTR_TYPE)
            {
                gridZeroObj = $.extend(true, {}, entry);
            }
            if (true == entry.NEED_HEADROW
                && undefined != gridZeroObj)
            {
                // must change SECT_HEAD of ZERO object
                gridZeroObj.SECTION_HEAD = entry.SECTION_HEAD;
                newRowData.push($.extend(true, {}, gridZeroObj));
                gridZeroObj = undefined;
            }

            // PBF
            if (null != preEntry
                && true == entry.PB_FRIEND)
            {

                var tmp1 = entry.FK_CDI_INSTR_TYPE;
                var isAMT = tmp1.match(/FI|MI|FM|PB|RE|OT|MU/) ? true : false;
                var tmp1Conv = convInstType(tmp1);
                var tmp1MF = tmp1.match(/MI|FI/) ? true : false;

                var PBF_SUBJ_CRSE = "";
                var curEnStatus = entry.ENROLL_STATUS;
                var curSubjCrse = entry.SUBJ_CODE.trim()
                    + " "
                    + entry.CRSE_CODE.trim();
                var curSectHead = entry.SECTION_HEAD;
                var curSectChar = entry.SECT_CODE.substr(0, 1);

                if (curSectHead != preSectHead)
                {
                    PBF_SUBJ_CRSE = curSubjCrse;
                    if (curEnStatus == preEnStatus
                        && curSubjCrse == preSubjCrse
                        && curSectChar == preSectChar)
                    {
                        isDupGroup = true;
                    }
                    else
                    {
                        isDupGroup = false;
                    }
                }

                preEnStatus = curEnStatus;
                preSubjCrse = curSubjCrse;
                preSectHead = curSectHead;
                preSectChar = curSectChar;

                var tmp3 = curSubjCrse.trim().replace(/\s/, '_');
                var pbfStatus = "";
                switch (entry.ENROLL_STATUS)
                {
                    case "EN":
                        pbfStatus = "Enrolled";
                        break;
                    case "WT":
                        pbfStatus = "Waitlist";
                        break;
                    case "PL":
                        pbfStatus = "Planned";
                        break;
                }

                var crseTitle = entry.CRSE_TITLE;
                var longDesc = entry.LONG_DESC;

                // subtitle
                if (null != longDesc
                    && !longDesc.match(/^\s*$/))
                {
                    crseTitle = entry.CRSE_TITLE.trim()
                        + "<br /> - "
                        + longDesc;
                }

                // course header
                if ("" !== PBF_SUBJ_CRSE
                    && !isDupGroup)
                {
                    cLocalDataPBF.push({
                        SECTION_HEAD : entry.SECTION_HEAD,
                        SECTION_NUMBER : entry.SECTION_NUMBER,
                        PBF_SUBJ_CRSE : PBF_SUBJ_CRSE,
                        PBF_TITLE : crseTitle,
                        PBF_STATUS : pbfStatus,
                        PBF_MTYPE : "",
                        PBF_DAY : "",
                        PBF_DATE : "",
                        PBF_TIME : "",
                        PBF_BLDG : "",
                        PBF_ROOM : "",
                        ENROLL_STATUS : entry.ENROLL_STATUS
                    });
                }

                // pbf header
                if (!tmp1MF)
                {

                    if (undefined != preEntry.FK_CDI_INSTR_TYPE
                        && preEntry.FK_CDI_INSTR_TYPE != entry.FK_CDI_INSTR_TYPE)
                    {
                        // header row
                        var tmpObj = $.extend(true, {}, entry);
                        tmpObj.PERSON_FULL_NAME = 'HEADER_'
                            + tmp1Conv;
                        tmpObj.ADDINFO = tmp3;

                        newRowData.push(tmpObj);

                        if (!isDupGroup)
                        {
                            cLocalDataPBF.push({
                                SECTION_HEAD : entry.SECTION_HEAD,
                                SECTION_NUMBER : entry.SECTION_NUMBER,
                                PBF_SUBJ_CRSE : "",
                                PBF_TITLE : tmp1Conv,
                                PBF_STATUS : "",
                                PBF_MTYPE : tmp1,
                                PBF_DAY : "",
                                PBF_DATE : "",
                                PBF_TIME : "",
                                PBF_BLDG : "",
                                PBF_ROOM : "",
                                ENROLL_STATUS : entry.ENROLL_STATUS,
                                PBF_INFO : tmp3,
                                PBF_HEAD : 'HEADER_'
                                    + tmp1Conv
                            });
                        }
                        sHSN = entry.SECTION_HEAD
                            + ""
                            + entry.SECTION_NUMBER;
                    }
                    // must be after header
                    if (undefined != entry.FK_CDI_INSTR_TYPE
                        && entry.FK_CDI_INSTR_TYPE.match(/FI|MI|FM|PB|RE|OT|MU/))
                    {
                        sHSN = entry.SECTION_HEAD
                            + ""
                            + entry.SECTION_NUMBER;
                    }
                    entry.ROW_ATTR = {
                        'rowClass' : 'wr-gridrow-class wr-gridrow-class-'
                            + tmp3
                            + "-"
                            + tmp1
                            + "-"
                            + sHSN
                    }
                }

                // cook pbf
                var PBF_SUBJ_CRSE = "";

                var PBF_TITLE = tmp1MF ? tmp1Conv : "";

                var PBF_MTYPE = entry.FK_CDI_INSTR_TYPE;
                var PBF_DAY = dayConvNum2Str(entry.DAY_CODE);
                var PBF_DATE = dateConvFormat1(entry.START_DATE);
                var PBF_TIME = timeConvSE(entry.BEGIN_HH_TIME, entry.BEGIN_MM_TIME, entry.END_HH_TIME, entry.END_MM_TIME);

                var PBF_DATE_USE = "";
                if (isAMT)
                {
                    PBF_DATE_USE = PBF_DATE;
                }

                if (entry.FK_CDI_INSTR_TYPE.match(/FI/)
                    && !finalLocationDisplay)
                {
                    entry.BLDG_CODE = 'TBA';
                    entry.ROOM_CODE = 'TBA';
                }

                if (!isDupGroup)
                {

                    var PBF_BLDG = entry.BLDG_CODE;
                    var PBF_ROOM = entry.ROOM_CODE.trim();

                    var tmp4 = "";
                    if (!tmp1MF)
                    {
                        if (undefined != entry.FK_CDI_INSTR_TYPE
                            && entry.FK_CDI_INSTR_TYPE.match(/FI|MI|FM|PB|RE|OT|MU/))
                        {
                            sHSN = entry.SECTION_HEAD
                                + ""
                                + entry.SECTION_NUMBER;
                        }
                        tmp4 = {
                            'rowClass' : 'wr-pbfrow-class wr-pbfrow-class-'
                                + tmp3
                                + "-"
                                + tmp1
                                + "-"
                                + sHSN
                        };
                    }
                    cLocalDataPBF.push({
                        SECTION_HEAD : entry.SECTION_HEAD,
                        SECTION_NUMBER : entry.SECTION_NUMBER,
                        PBF_SUBJ_CRSE : PBF_SUBJ_CRSE,
                        PBF_TITLE : PBF_TITLE,
                        PBF_STATUS : "",
                        ENROLL_STATUS : entry.ENROLL_STATUS,
                        PBF_MTYPE : PBF_MTYPE,
                        PBF_DAY : PBF_DAY,
                        PBF_DATE : PBF_DATE_USE,
                        PBF_TIME : PBF_TIME,
                        PBF_BLDG : PBF_BLDG,
                        PBF_ROOM : PBF_ROOM,
                        ROW_ATTR : tmp4
                    });
                }

            }

            newRowData.push(entry);
            preEntry = entry;

        });
        cLocalData.length = 0;
        cLocalData = null; // release

        $.each(newRowData, function(index, entry)
        {
            gridObj.jqGrid('addRowData', index, entry);
        });

        data = [];
        var ids = gridObj.jqGrid('getDataIDs');
        var rowId;
        var rowId2;

        // planSectNumList - get all plan section numbers
        var planSectNumList = [];
        planSectNumList.length = 0;
        for (var i = 0; i < ids.length; i++)
        {
            rowId = ids[i];
            if (undefined == newRowData[i])
            {
                return;
            }
            if ('PL' != newRowData[i].ENROLL_STATUS) continue;
            if (-1 == $.inArray(newRowData[i].SECTION_HEAD, planSectNumList))
            {
                planSectNumList.push(newRowData[i].SECTION_HEAD);
            }
        }

        // find plan enrollerbilities
        if (planSectNumList.length > 0)
        {
            wrapperGetEnrollDetail(planSectNumList, function(data)
            {
                planSectNumEnrollDetail = [];
                planSectNumEnrollDetail.length = 0;
                planSectNumEnrollDetail = data;
            });
        }

        numButtonEnrollRows = 0;
        for (var i = 0; i < ids.length; i++)
        {
            rowId = ids[i];
            if (undefined == newRowData[i])
            {
                return;
            }

            var sectHead = newRowData[i].SECTION_HEAD;
            var subjCode = newRowData[i].SUBJ_CODE;
            var crseCode = newRowData[i].CRSE_CODE;
            var subj = subjCode.trim()
                + " "
                + crseCode;
            var longDesc = newRowData[i].LONG_DESC;
            var crseTitle = newRowData[i].CRSE_TITLE;

            // subtitle test with FA14 mus95w-00 mus15 - non00
            if (null != longDesc
                && !longDesc.match(/^\s*$/))
            {
                crseTitle = newRowData[i].CRSE_TITLE.trim()
                    + "<br /> - "
                    + longDesc;
            }

            if (isSummerSession3)
            {
                crseTitle += "<br />"
                    + dateConvFormat1(newRowData[i].START_DATE)
                    + " - "
                    + dateConvFormat1(newRowData[i].END_DATE);
            }

            // time
            var beginHH = newRowData[i].BEGIN_HH_TIME;
            var beginMM = newRowData[i].BEGIN_MM_TIME;
            var endHH = newRowData[i].END_HH_TIME;
            var endMM = newRowData[i].END_MM_TIME;
            var timeStr = timeConvSE(beginHH, beginMM, endHH, endMM);

            // day
            var dayStr = dayConvNum2Str(newRowData[i].DAY_CODE);
            if (dayStr == "")
            {
                dayStr = "TBA";
            }

            // unit format
            var unitForm = newRowData[i].SECT_CREDIT_HRS.toFixed(2);

            // instructor grid
            var instNamesTmp = newRowData[i].PERSON_FULL_NAME.split(':');
            var instNamesTip = ""
            var instNames = [];
            $.each(instNamesTmp, function(index, entry)
            {
                entry = entry.trim();
                if ($.inArray(entry, instNames) === -1)
                {
                    instNames.push(entry);
                    if (0 == index)
                    {
                        instNamesTip = entry;
                    }
                    else
                    {
                        instNamesTip = instNamesTip
                            + " / "
                            + entry;
                    }
                }
            });
            var staffCheck = false;
            $.each(instNames, function(index, entry)
            {
                if (entry.match(/^\s*staff\s*$/i))
                {
                    staffCheck = true;
                    return false;
                }
                if (index == 0)
                {

                    instNames = '<span title="'
                        + instNamesTip
                        + '">'
                        + entry;
                }
                else
                {
                    instNames += ' + ';
                    return false;
                }
            });
            if (!staffCheck)
            {
                instNames = instNames
                    + '</span>';
            }
            // enStatusArr - grid
            var enStatusArr = [];
            switch (newRowData[i].ENROLL_STATUS)
            {
                case "EN":
                    enStatusArr[0] = 0;
                    enStatusArr[1] = "Enrolled";
                    break;
                title = "Your position on the waitlist is ' +  rawObject.WT_POS + '"
            case "WT":
                enStatusArr[0] = 1;
                enStatusArr[1] = "<span title='Your position on the waitlist is "
                    + newRowData[i].WT_POS
                    + "'>Waitlist ("
                    + newRowData[i].WT_POS
                    + ")</span>";
                break;
            case "PL":
                enStatusArr[0] = 2;
                enStatusArr[1] = "Planned";
                break;
        }

        var gradingOption = gradeOptionGridConv(newRowData[i].GRADE_OPTION);

        gridObj.jqGrid('setRowData', rowId, {
            colsubj : subj,
            CRSE_TITLE : crseTitle,
            DAY_CODE : dayStr,
            coltime : timeStr,
            colstatus : enStatusArr[1],
            colstatusorg : enStatusArr[1],
            SECT_CREDIT_HRS : unitForm,
            PERSON_FULL_NAME : instNames,
            GRADE_OPTION : gradingOption,
            BLDG_CODE : newRowData[i].BLDG_CODE.trim(),
            ROOM_CODE : newRowData[i].ROOM_CODE.trim()
        });

        // button grid -----------------------------
        switch (enStatusArr[0])
        {
            case 0:
                var gridButClassList = " wrbuttong grid-but-enroll-class ";
                break;
            case 1:
                var gridButClassList = " wrbuttong grid-but-wait-class ";
                break;
            case 2:
                var gridButClassList = " wrbuttong grid-but-plan-class ";
                break;

        }

        var optClass = "";

        if (2 == enStatusArr[0]
            && isAlreadyExist(undefined, subjCode, crseCode, 'EN')[0])
        { // enrolled
            optClass = " noMoreEnWtGridClass ";
        }

        if (newRowData[i].SECT_CODE.match(/00$/)
            || newRowData[i].SECT_CODE.match(/^\d+$/))
        {

            if (undefined != newRowData[i].FK_CDI_INSTR_TYPE
                && !newRowData[i].FK_CDI_INSTR_TYPE.match(/FI|MI|FM|PB|RE|OT|MU/)
                && 0 == enStatusArr[0])
            {
                numButtonEnrollRows++;
            }

            if (2 == enStatusArr[0])
            { // 2 == PL
                var isEnrollAllow = false;
                if (undefined != planSectNumEnrollDetail[sectHead])
                {
                    isEnrollAllow = isEnrollOrWaitBut(
                        sectHead,
                        planSectNumEnrollDetail[sectHead].AVAIL_SEAT,
                        planSectNumEnrollDetail[sectHead].STP_ENRLT_FLAG,
                        newRowData[i].SUBJ_CODE,
                        newRowData[i].CRSE_CODE);
                }

                if (isEnrollAllow)
                {
                    var gridButEdit = "<input "
                        + " id=grid-edit-plan-id-enroll-"
                        + rowId
                        + " class=' wrbutton wrbuttong wrbuttongr secondary grid-but-plan-enwt-class grid-but-plan-enroll-class "
                        + gridButClassList
                        + optClass
                        + " ' "
                        + " type='button' value='Enroll' />";
                }
                else
                {
                    var gridButEdit = "<input "
                        + " id=grid-edit-plan-id-wait-"
                        + rowId
                        + " class=' wrbutton wrbuttong wrbuttongr secondary grid-but-plan-enwt-class grid-but-plan-wait-class "
                        + gridButClassList
                        + optClass
                        + " ' "
                        + " type='button' value='Waitlist' />";
                }
                var gridButDrop = "<input "
                    + " id=grid-drop-plan-id-"
                    + rowId
                    + " class=' wrbutton wrbuttong wrbuttongl secondary grid-but-plan-remove-class "
                    + gridButClassList
                    + " ' "
                    + " type='button' value='Remove' />";

            }
            else
            {
                var gridButEdit = "<input "
                    + " id=grid-edit-id-"
                    + rowId
                    + " class=' wrbutton wrbuttong wrbuttongr secondary grid-but-eddr-class grid-but-edit-class "
                    + gridButClassList
                    + " ' "
                    + " type='button' value='Change' />";

                var gridButDrop = "<input "
                    + " id=grid-drop-id-"
                    + rowId
                    + " class=' wrbutton wrbuttong wrbuttongl secondary grid-but-eddr-class grid-but-drop-class "
                    + gridButClassList
                    + " ' "
                    + " type='button' value='Drop' />";
            }

            var gridButGroup = gridButDrop
                + gridButEdit;
            gridObj.jqGrid('setCell', rowId, 'colaction', gridButGroup);
        }

        // cell view adjust
        var rowEle = $("#list-id-table tbody tr#"
            + rowId
            + "");
        switch (enStatusArr[0])
        {
            case 0:
                rowEle.addClass('wr-grid-en');
                break;
            case 1:
                rowEle.addClass('wr-grid-wt');
                break;
            case 2:
                rowEle.addClass('wr-grid-pl');
                break;
        }

    } // for

    // handler grid
    // must install handler after all grid data set above
    for (var i = 0; i < ids.length; i++)
    {

        rowId = ids[i];

        // section_head
        var sectionHead = newRowData[i].SECTION_HEAD;
        var enStatus = newRowData[i].ENROLL_STATUS;
        var subjCode = newRowData[i].SUBJ_CODE;
        var crseCode = newRowData[i].CRSE_CODE;
        var stitle = newRowData[i].CRSE_TITLE;
        var unitDefault = newRowData[i].SECT_CREDIT_HRS;

        var h_sectionHead;
        var ids2 = gridObj.jqGrid('getDataIDs');
        for (var j = 0; j <= ids2.length; j++)
        {
            rowId2 = ids2[j];
            var rowData = gridObj.jqGrid('getRowData', rowId2);
            if (rowData['SECTION_NUMBER'] == sectionHead)
            {
                h_sectionHead = sectionHead;
                break;
            }
        }

        var classObj = {
            objid : "grid:"
                + rowId, // rowId whatever it is now
            sectionHead : h_sectionHead, enStatus : enStatus
        };

        var thisRowData = $("#list-id-table").jqGrid('getRowData', rowId);
        var thisGradeEnable = false;
        var thisUnitEnable = false;
        var thisEnrollStatus = thisRowData.colstatus;

        if (undefined != thisEnrollStatus)
        {
            if (thisEnrollStatus.toString().match(/enroll/i))
            {
                if (thisRowData.GRADE_OPTN_CD_PLUS == '+')
                {
                    thisGradeEnable = true;
                }
                if (thisRowData.SECT_CREDIT_HRS_PL == '+')
                {
                    thisUnitEnable = true;
                }

            }
            else if (thisEnrollStatus.toString().match(/waitlist/i))
            {
                var tmp = checkAndGetGradeUnit(sectionHead);
                thisGradeEnable = tmp[0];
                thisUnitEnable = tmp[1];
            }
        }

        if (!thisGradeEnable
            && !thisUnitEnable)
        {
            $('#grid-edit-id-'
                + i).button().button('disable');
            $('#grid-edit-id-'
                + i).attr('title', noChangeTitle);

        }
        else
        {
            $('#grid-edit-id-'
                + i).click(classObj, classEditFun);
        }
        $('#grid-drop-id-'
            + i).click(classObj, classDropFun);

        // closure
        $('#grid-edit-plan-id-enroll-'
            + i).click((function(a, b, c, d, e, f, g)
        {
            return function()
            {
                classEnrollFun(a, b, c, d, e, f, g);
            };
        })(h_sectionHead, "enroll", subjCode, crseCode, stitle, undefined, undefined));

        // closure
        $('#grid-edit-plan-id-wait-'
            + i).click((function(a, b, c, d, e, f, g)
        {
            return function()
            {
                classEnrollFun(a, b, c, d, e, f, g);
            };
        })(h_sectionHead, "wait", subjCode, crseCode, stitle, undefined, undefined));

        var classObjPlanRm = {
            actionTip : "<b style='font-size:16px' >Would you like to remove the following planned class?</b>", sectionHead : h_sectionHead
        };

        $('#grid-drop-plan-id-'
            + i).click(classObjPlanRm, classPlanRemoveFun);

    }

    // disable buttons - grid. after loading all rows
    // can't be in gridcomplete - rows are not loaded

    // time restriction
    disableGridButtons();

    // must >>>blank only after we install handlers above
    var prevSubj = "";
    var curSubj = "";
    var prevSch = "";
    var curSch = "";
    var prevStat = "";
    var curStat = "";
    var prevSectHead = "";
    var curSectHead = "";

    for (var i = 0; i < ids.length; i++)
    {
        var rowId = i;
        var isEntry00 = newRowData[i].SECT_CODE.match(/00$/) ? true : false;
        var isPlan = ('PL' == newRowData[i].ENROLL_STATUS) ? true : false;

        if (rowId == 0)
        {
            prevSubj = gridObj.jqGrid('getCell', rowId, 'colsubj');
            prevSch = gridObj.jqGrid('getCell', rowId, 'SECT_CODE');
            prevStat = gridObj.jqGrid('getCell', rowId, 'colstatus');
            prevStat = getStatusFromCell(prevStat);
            prevSectHead = gridObj.jqGrid('getCell', rowId, 'SECTION_HEAD');

        }
        else
        {
            curSubj = gridObj.jqGrid('getCell', rowId, 'colsubj');
            curSch = gridObj.jqGrid('getCell', rowId, 'SECT_CODE');
            curStat = gridObj.jqGrid('getCell', rowId, 'colstatus');
            curStat = getStatusFromCell(curStat);
            curSectHead = gridObj.jqGrid('getCell', rowId, 'SECTION_HEAD');

            if (prevSubj == curSubj
                && prevSch.substring(0, 1) == curSch.substring(0, 1)
                && prevStat == curStat
                && prevSectHead == curSectHead)
            {
                var section_code = (newRowData[i].PB_FRIEND) ? ' ' : newRowData[i].SECT_CODE;
                gridObj.jqGrid('setCell', rowId, 'SECT_CODE', section_code);
                gridObj.jqGrid('setCell', rowId, 'colsubj', ' ');
                gridObj.jqGrid('setCell', rowId, 'CRSE_TITLE', ' ');
                gridObj.jqGrid('setCell', rowId, 'GRADE_OPTION', ' ');
                gridObj.jqGrid('setCell', rowId, 'SECT_CREDIT_HRS', ' ');
                gridObj.jqGrid('setCell', rowId, 'PERSON_FULL_NAME', ' ');
                gridObj.jqGrid('setCell', rowId, 'colstatus', ' ');
                gridObj.jqGrid('setCell', rowId, 'WT_POS', ' ');
                gridObj.jqGrid('setCell', rowId, 'colaction', ' ');
            }
            prevSubj = curSubj;
            prevSch = curSch;
            prevStat = curStat;
            prevSectHead = curSectHead;
        }
    }

    // PBF
    $.each(newRowData, function(rowId, entry)
    {

        if (entry.PERSON_FULL_NAME.match(/HEADER_/))
        {

            var sessionName = entry.PERSON_FULL_NAME.substring(7);

            var thisTitle = "<div class='wr-gridrow-header-outer-class' id='wr-gridrow-header-outer-id-"
                + rowId
                + "'><img class='wr-gridrow-header-class' alt='Expand: ' id='wr-gridrow-header-id-"
                + rowId
                + "' src='"
                + imgRight
                + "' "
                + " style=' width:8px; height:8px; margin-right: 2px; margin-top: 5px;' ></img> "
                + sessionName
                + "</div>";

            gridObj.jqGrid('setCell', rowId, 'SECT_CODE', ' ');
            gridObj.jqGrid('setCell', rowId, 'colsubj', ' ');
            gridObj.jqGrid('setCell', rowId, 'CRSE_TITLE', thisTitle);
            gridObj.jqGrid('setCell', rowId, 'FK_CDI_INSTR_TYPE', ' ');
            gridObj.jqGrid('setCell', rowId, 'PERSON_FULL_NAME', ' ');
            gridObj.jqGrid('setCell', rowId, 'GRADE_OPTION', ' ');
            gridObj.jqGrid('setCell', rowId, 'SECT_CREDIT_HRS', ' ');
            gridObj.jqGrid('setCell', rowId, 'DAY_CODE', ' ');
            gridObj.jqGrid('setCell', rowId, 'coltime', ' ');
            gridObj.jqGrid('setCell', rowId, 'BLDG_CODE', ' ');
            gridObj.jqGrid('setCell', rowId, 'ROOM_CODE', ' ');
            gridObj.jqGrid('setCell', rowId, 'colstatus', ' ');
            gridObj.jqGrid('setCell', rowId, 'WT_POS', ' ');
            gridObj.jqGrid('setCell', rowId, 'colaction', ' ');

            var sHSN = entry.SECTION_HEAD
                + ""
                + entry.SECTION_NUMBER;
            $("#wr-gridrow-header-outer-id-"
                + rowId).click(function()
            {
                var curImgSrc = $("#wr-gridrow-header-id-"
                    + rowId).attr('src');
                if (curImgSrc === imgDown)
                {
                    $("#wr-gridrow-header-id-"
                        + rowId).attr('src', imgRight);
                    $(".wr-gridrow-class-"
                        + entry.ADDINFO
                        + "-"
                        + entry.FK_CDI_INSTR_TYPE
                        + "-"
                        + sHSN).addClass('grid-row-hidden');
                }
                else
                {
                    $("#wr-gridrow-header-id-"
                        + rowId).attr('src', imgDown);
                    $(".wr-gridrow-class-"
                        + entry.ADDINFO
                        + "-"
                        + entry.FK_CDI_INSTR_TYPE
                        + "-"
                        + sHSN).removeClass('grid-row-hidden');

                }
            });
            return;

        }
        if (undefined != entry.FK_CDI_INSTR_TYPE
            && entry.FK_CDI_INSTR_TYPE.match(/FI|MI|FM|PB|RE|OT|MU/))
        {
            if (entry.START_DATE.indexOf("TBA") > -1)
            {
                dayStr = "TBA";
            }
            else
            {
                var dayStr = gridObj.jqGrid('getCell', rowId, 'DAY_CODE');
                dayStr = dayStr
                    + " "
                    + dateConvFormat1(entry.START_DATE);
            }

            gridObj.jqGrid('setCell', rowId, 'DAY_CODE', dayStr);

            switch (entry.FK_CDI_INSTR_TYPE)
            {
                case "MI":
                    gridObj.jqGrid('setCell', rowId, 'CRSE_TITLE', 'Midterm');
                    break;
                case "FI":
                    gridObj.jqGrid('setCell', rowId, 'CRSE_TITLE', 'Final Exam');
                    break;
            }
        }

    });
    $(".wr-gridrow-class").addClass('grid-row-hidden');
}
gridBuildAll();

function disableGridButtons()
{
    if (!waitlistAble)
    {
        $('.grid-but-plan-wait-class').button().button('disable');
        $('.grid-but-plan-wait-class').attr('title', notWaitlistableMsg);
    }
    if (!editAble)
    {
        $('.grid-but-edit-class').button().button('disable');
        $('.grid-but-edit-class').attr('title', notEditableMsg);
    }
    if (!dropAble)
    {
        $('.grid-but-drop-class').button().button('disable');
        $('.grid-but-drop-class').attr('title', notDropableMsg);
    }

    // personal restriction
    if (got56or64)
    { // disable all except plan remove
        $('.grid-but-eddr-class').button().button('disable');
        $('.grid-but-eddr-class').attr('title', got56or64Msg);
        $('.grid-but-plan-enwt-class').button().button('disable');
        $('.grid-but-plan-enwt-class').attr('title', got56or64Msg);
    }
    else if (!enrollAddIsTodayBetween)
    {
        $('.grid-but-plan-enwt-class').button().button('disable');
        $('.grid-but-plan-enwt-class').attr('title', got56or64Msg);
    }

    if (gotFtype)
    {
        $('.noMoreEnWtGridClass').button().button('disable');
        $('.noMoreEnWtGridClass').attr('title', gotFtypeMsg);
    }

    if (gotMD)
    { // disable all button
        $('.wrbuttong').button().button('disable');
        $('.wrbuttong').attr('title', gotMDMsg);
    }
}

function getStatusFromCell(cell)
{
    return cell.split(" ")[0];
}

function getPositionFromCell(cell)
{
    return cell.match(/[0-9]+/g);
}

// event in list
function listEventBuildAll()
{

    $("#list-id-event").jqGrid("GridUnload");

    if (0 == aeEventArr.length)
    {
        return;
    }

    $('#list-id-event').jqGrid({
        caption : "My Events", datatype : "local", height : '100%', gridview : true, loadonce : true, sortable : true, rowNum : 100, viewrecords : true, cmTemplate : {
            title : false
        },

        beforeSelectRow : function(rowid, e)
        {
            return false; // lose focus
        },

        onRightClickRow : function()
        {
            $("#list-id-event").jqGrid('resetSelection');
            return false;
        },

        colNames : [ 'Name', 'Location', 'Start', 'End', 'Days', 'Action', '' // IE8
        // COMPATIBILITY
        ],

        colModel : [ {
            name : 'DESCRIPTION', jsonmap : "DESCRIPTION", fixed : true, width : 150, align : 'left', editable : false, sortable : false
        }, {
            name : 'LOCATION', jsonmap : "LOCATION", fixed : true, width : 150, align : 'left', editable : false, sortable : false
        }, {
            name : 'EV_START_TIME', jsonmap : "START_TIME", fixed : true, width : 100, align : 'center', editable : false, sortable : false
        }, {
            name : 'EV_END_TIME', jsonmap : "END_TIME", fixed : true, width : 100, align : 'center', editable : false, sortable : false
        }, {
            name : 'EV_DAYS', jsonmap : "DAYS", fixed : true, width : 200, align : 'center', editable : false, sortable : false
        }, {
            name : 'ACTION', jsonmap : "ACTION", fixed : true, width : 120, align : 'center', editable : false, sortable : false
        }, {
            name : 'nothing', fixed : true, width : 30, align : 'center', editable : false, sortable : false, hidden : !isIE8
        } // IE8 COMPATIBILITY
        ],

        rowattr : function(rd)
        {
            var res = '';
            var attr = rd.ROW_ATTR;
            if (undefined != attr)
            {
                if (undefined != rd.ROW_ATTR.rowClass)
                {
                    res = {
                        "class" : rd.ROW_ATTR.rowClass
                    };
                }
            }
            return res;
        }
    });

    var gridObjEv = $("#list-id-event");

    $
        .each(
            aeEventArr,
            function(index, entry)
            {

                var rowId = index;
                var evStart = timeConv24To12(entry.START_TIME);
                var evEnd = timeConv24To12(entry.END_TIME);

                // days
                var daysArr = entry.DAYS.split('');
                var checkedTF1 = ('1' == daysArr[0]) ? " checked " : "";
                var checkedTF2 = ('1' == daysArr[1]) ? " checked " : "";
                var checkedTF3 = ('1' == daysArr[2]) ? " checked " : "";
                var checkedTF4 = ('1' == daysArr[3]) ? " checked " : "";
                var checkedTF5 = ('1' == daysArr[4]) ? " checked " : "";
                var checkedTF6 = ('1' == daysArr[5]) ? " checked " : "";
                var checkedTF7 = ('1' == daysArr[6]) ? " checked " : "";
                var evDays = '<table style="width:100%; margin-top:0px;" class="wr-gridevent-class" ><tr> <td ><label>Mon</label></td> <td ><label>Tue</label></td> <td ><label>Wed</label></td> <td ><label>Thu</label></td> <td ><label>Fri</label></td> <td ><label>Sat</label></td> <td ><label>Sun</label></td> </tr> <tr>'
                    + '	<td ><input disabled '
                    + checkedTF1
                    + ' type="checkbox" /></td>'
                    + '	<td ><input disabled '
                    + checkedTF2
                    + ' type="checkbox" /></td>'
                    + '	<td ><input disabled '
                    + checkedTF3
                    + ' type="checkbox" /></td>'
                    + '	<td ><input disabled '
                    + checkedTF4
                    + ' type="checkbox" /></td>'
                    + '	<td ><input disabled '
                    + checkedTF5
                    + ' type="checkbox" /></td>'
                    + '	<td ><input disabled '
                    + checkedTF6
                    + ' type="checkbox" /></td>'
                    + '	<td ><input disabled '
                    + checkedTF7
                    + ' type="checkbox" /></td>'
                    + '	</tr></table>';

                // Action
                var evActionEdit = "<input "
                    + " id=ev-edit-id-"
                    + rowId
                    + " class=' wrbutton wrbuttong wrbuttongr secondary ' "
                    + " type='button' value='Change' />";

                var evActionRemove = "<input "
                    + " id=ev-remove-id-"
                    + rowId
                    + " class=' wrbutton wrbuttong wrbuttongl secondary ' "
                    + " type='button' value='Remove' />";

                var evAction = evActionRemove
                    + evActionEdit;

                gridObjEv.jqGrid('addRowData', rowId, {
                    EV_START_TIME : evStart, EV_END_TIME : evEnd, EV_DAYS : evDays, DESCRIPTION : entry.DESCRIPTION, LOCATION : entry.LOCATION, ACTION : evAction
                });

                var classEventObj = {
                    aeName : entry.DESCRIPTION,
                    aeDays : entry.DAYS,
                    aeLocation : entry.LOCATION,
                    aeStartTime : entry.START_TIME,
                    aeEndTime : entry.END_TIME,
                    aeTimeStamp : entry.TIME_STAMP
                };

                $("#ev-edit-id-"
                    + rowId).click(classEventObj, eventEditFun);
                $("#ev-remove-id-"
                    + rowId).click(classEventObj, eventRemoveFun);

            });

}
listEventBuildAll();

// booklist
function bookListBuildAll()
{
    var cBookData = getCopyData(cGlobData);
    var bookENList = [];
    bookENList.length = 0;
    var bookWTList = [];
    bookENList.length = 0;
    var bookFoundObj = {};

    $.each(cBookData, function(index, entry)
    {

        if (entry.SECTION_NUMBER != entry.SECTION_HEAD)
        {
            return;
        }

        if (bookFoundObj[entry.SECTION_NUMBER])
        {
            return;
        }
        bookFoundObj[entry.SECTION_NUMBER] = true;

        if ('EN' == entry.ENROLL_STATUS)
        {
            bookENList.push(entry.SUBJ_CODE.trim()
                + "."
                + entry.CRSE_CODE
                + "."
                + entry.SECTION_NUMBER);
        }
        if ('WT' == entry.ENROLL_STATUS)
        {
            bookWTList.push(entry.SUBJ_CODE
                + "."
                + entry.CRSE_CODE
                + "."
                + entry.SECTION_NUMBER);
        }
    });

    var bookENListParam = "";
    if (bookENList.length > 0)
    {
        bookENListParam = "&class="
            + bookENList.join(":").replace(/\s/g, '');
    }

    var bookWTListParam = "";
    if (bookWTList.length > 0)
    {
        bookWTListParam = "&waitlist="
            + bookWTList.join(":").replace(/\s/g, '');
    }

    cBookData.length = 0;
    cBookData = null;
    bookENList.length = 0;
    bookENList = null;
    bookWTList.length = 0;
    bookWTList = null;
    bookFoundObj = {};
    bookFoundObj = null;

    $('#view-booklist').empty();
    if (cGlobData.length > 0)
    {
        // print link
        $('#view-booklist').append('<a id="print-link" href="#">Print Schedule</a>');
        $('#view-booklist').on('click', '#print-link', printSchedule);
    }
    if ('' != bookENListParam
        || '' != bookWTListParam)
    {
        $('#view-booklist').append(" | <a id='viewbooklistlink' style='color:white;' target='_blank' href='https://www.bkstr.com/ucsdtextstore/shop/textbooks-and-course-materials" 
           //wrtx/FullBookList?term=
           // + urlParam1
           // + bookENListParam
           // + bookWTListParam
            + "'>View Book List</a>");
    }
}
bookListBuildAll();

// setup for print
function printSchedule()
{
    $(".wr-gridrow-class").removeClass('grid-row-hidden');
    $(".wr-pbfrow-class").removeClass('grid-row-hidden');
    window.print();
    $('.wr-gridrow-header-class').attr('src', imgRight);
    $('.wr-pbfrow-header-class').attr('src', imgRight);
    $(".wr-gridrow-class").addClass('grid-row-hidden');
    $(".wr-pbfrow-class").addClass('grid-row-hidden');
    return false;
}

// calendar -------------------------------------------------------------

/*
 * View class info from calendar.
 */
$("#dialog-view").dialog({
    autoOpen : false, maxWidth : 1050, position : {
        my : "center", at : "center", of : window
    }, height : 'auto', width : 1050, modal : true, closeOnEscape : false, buttons : {

        Cancel : {
            text : "Close", click : function()
            {
                $(this).dialog("close");
            }
        }
    }
});

$("#dialog-choose").dialog({
    autoOpen : false, maxWidth : 1050, position : {
        my : "center", at : "center", of : window
    }, height : 'auto', width : 1050, modal : true, closeOnEscape : false, buttons : {

        Cancel : {
            text : "Close", click : function()
            {
                $(this).dialog("close");
            }
        }
    }
});

function getClassCalFun(aeEventArr, dataOrg, start, end, callback)
{

    // filter
    var tmpObj = {};
    duplicateCalSections = [];
    duplicateCalSections.length = 0;
    var data = [];
    data.length = 0;
    $.each(dataOrg, function(index, entry)
    {
        if (true == entry.PB_FRIEND)
        {
            return;
        }
        if ("WT" == entry.ENROLL_STATUS)
        { // can't have duplicate WT classes
            data.push(entry);
            return;
        }

        var key = entry.SECTION_NUMBER
            + entry.ENROLL_STATUS
            + entry.DAY_CODE
            + timeConvSE(entry.BEGIN_HH_TIME, entry.BEGIN_MM_TIME, entry.END_HH_TIME, entry.END_MM_TIME);
        if (!(key in tmpObj))
        {
            tmpObj[key] = true;
            data.push(entry);
        }
        else
        {
            entry.DUPLICATE = true;
            data.push(entry);
            duplicateCalSections.push(entry);
        }
    });
    tmpObj = {};
    tmpObj = null;

    var classEvents = [];
    var idBase = new Date().getTime();
    timeObjArrCal = [];
    timeObjArrCal.length = 0;
    $('#calendar-id-tba').empty();

    var sectionHeads = [];
    var eventViews = [];

    // event
    $.each(aeEventArr, function(index, entry)
    {
        var desc = entry.DESCRIPTION;
        var loc = entry.LOCATION;
        // "2014-10-08 14:17:36.354443"

        var itemTitle = desc
            + "<br>"
            + loc;

        var days = [];
        days = entry.DAYS.split('');

        for (var i = 0; i < days.length; i++)
        {

            if ('0' == days[i])
            {
                continue;
            }
            ;

            var day = i + 1; // MON-SUN

            var itemId = Number(idBase)
                + "000"
                + index
                + i;
            var itemStart = "9"
                + day
                + entry.START_TIME;
            var itemEnd = "9"
                + day
                + entry.END_TIME;

            var currentEvent = {
                id : itemId,
                start : dateConvDB2Cal(itemStart),
                end : dateConvDB2Cal(itemEnd),
                title : itemTitle,
                enStatus : 'EV' // event
                ,
                className : evClass
                    + ' wr-event-cal-'
                    + itemId,
                aeName : desc,
                aeDay : day,
                aeDays : entry.DAYS,
                aeLocation : loc,
                aeStartTime : entry.START_TIME,
                aeEndTime : entry.END_TIME,
                aeTimeStamp : entry.TIME_STAMP
            };
            classEvents.push(currentEvent);

        }
    });

    var calTba = {};
    $.each(data, function(index, entry)
    {

        if (isSummerSession3)
        { // don't show completed courses in special summer session
            if (todayStr.localeCompare(String(entry.END_DATE)) > 0)
            {
                return;
            }
        }

        // meeting type
        var mType = entry.FK_CDI_INSTR_TYPE;

        // PBF
        if (undefined != mType
            && mType.match(/FI|MI|FM|PB|RE|MU/))
        {
            return;
        }

        var sType = entry.FK_SPM_SPCL_MTG_CD;
        if (sType == undefined
            || sType.trim() != "")
        {
            return;
        }

        var sectionHead = entry.SECTION_HEAD;
        var itemId = Number(idBase)
            + index;
        var day = entry.DAY_CODE;

        var beginHH = String("0"
            + entry.BEGIN_HH_TIME).slice(-2);
        var beginMM = String("0"
            + entry.BEGIN_MM_TIME).slice(-2);
        var endHH = String("0"
            + entry.END_HH_TIME).slice(-2);
        var endMM = String("0"
            + entry.END_MM_TIME).slice(-2);

        var itemStartTime = beginHH
            + ""
            + beginMM;
        var itemEndTime = endHH
            + ""
            + endMM;
        var itemStart = "9"
            + day
            + itemStartTime;
        var itemEnd = "9"
            + day
            + itemEndTime;

        switch (entry.ENROLL_STATUS)
        {
            case 'EN':
                var eventClass = enClass;
                break;
            case 'WT':
                var eventClass = wtClass;
                break;
            case 'PL':
                var eventClass = plClass;
                break;
        }

        if ('PL' != entry.ENROLL_STATUS)
        {
            timeObjArrCal.push({
                startTime : itemStartTime, endTime : itemEndTime, dayCode : day, sectionHead : sectionHead
            })
        }

        var subjCrse = entry.SUBJ_CODE
            + " "
            + entry.CRSE_CODE;

        var build = entry.BLDG_CODE;
        if ("" == build.trim())
        {
            build = 'TBA';
        }

        var room = entry.ROOM_CODE;
        if ("" == room.trim())
        {
            room = 'TBA';
        }

        // instructor cal
        var instNamesTmp = entry.PERSON_FULL_NAME.split(':');
        var instNamesTip = ""
        var instNames = [];
        $.each(instNamesTmp, function(index, entry)
        {
            entry = entry.trim();
            if ($.inArray(entry, instNames) === -1)
            {
                instNames.push(entry);
                if (0 == index)
                {
                    instNamesTip = entry;
                }
                else
                {
                    instNamesTip = instNamesTip
                        + " / "
                        + entry;
                }
            }
        });

        $.each(instNames, function(index, entry)
        {
            if (entry.match(/^\s*staff\s*$/i))
            {
                return false;
            }
            if (index == 0)
            {
                instNames = entry;
            }
            else
            {
                instNames = instNames
                    + '<span title="'
                    + instNamesTip
                    + '"> + </span> ';
                return false;
            }
        });

        // title
        var mTypeHtml = '<span title="'
            + convInstType(mType)
            + '">'
            + mType
            + '</span>';

        var itemTitle = "<span id='calendar-title-event-id-"
            + itemId
            + "' class='calendar-course-title calendar-section-"
            + sectionHead
            + "'>"
            + subjCrse
            + "</span>"
            + "<br /><div class='calendar-type-location'>"
            + mTypeHtml
            + " / "
            + '<a target="_blank"  class="nonewwin '
            + eventClass
            + '" href="https://maps.ucsd.edu/?id=1005#!s/'
            + build.trim()+"_Main?ct/18312"
            + '">'
            + build.trim()
            + " "
            + room.trim()
            + '</a></div>'
            + "<br /><div class='calendar-instructor'>"
            + instNames
            + "</div>";

        // tba items
        if (beginHH == 0
            && beginMM == 0
            && endHH == 0
            && endMM == 0)
        {
            var tbaKey = subjCrse.replace(/\s/g, "");
            if (!(tbaKey in calTba))
            {
                calTba[tbaKey] = true;
                $('#calendar-id-tba').append('<tr class="CALTBA_'
                    + entry.SECTION_HEAD
                    + '"'
                    + ' style="line-height:120%; color:black" >'
                    + ' <td style="text-align:left">'
                    + ' *No schedule time for '
                    + subjCrse
                    + ' </td></tr>');
            }
            return;
        }

        // grade and unit to enable?
        var thisGradeEnable = false;
        var thisUnitEnable = false;
        if ('EN' == entry.ENROLL_STATUS)
        {
            if ('+' == entry.GRADE_OPTN_CD_PLUS)
            {
                thisGradeEnable = true;
            }
            if ('+' == entry.SECT_CREDIT_HRS_PL)
            {
                thisUnitEnable = true;
            }
        }
        else if ('WT' == entry.ENROLL_STATUS)
        {
            var tmp = checkAndGetGradeUnit(sectionHead);
            thisGradeEnable = tmp[0];
            thisUnitEnable = tmp[1];
        }
        var wtcount = entry.COUNT_ON_WAITLIST || 0;
        var seatsAvailable = entry.SCTN_CPCTY_QTY
            - entry.SCTN_ENRLT_QTY;
        if (seatsAvailable < 0
            || entry.STP_ENRLT_FLAG === "Y")
        {
            seatsAvailable = 0;
        }
        if (entry.DUPLICATE == undefined)
        {
            classEvents.push({
                id : itemId,
                start : dateConvDB2Cal(itemStart),
                end : dateConvDB2Cal(itemEnd),
                title : itemTitle,
                enStatus : entry.ENROLL_STATUS,
                sectionHead : sectionHead,
                subjCode : entry.SUBJ_CODE,
                crseCode : entry.CRSE_CODE,
                subjCrse : subjCrse,
                stitle : entry.CRSE_TITLE,
                unitVal : entry.SECT_CREDIT_HRS,
                gradeVal : entry.GRADE_OPTION,
                gradeEnable : thisGradeEnable,
                unitEnable : thisUnitEnable,
                aeDay : entry.DAY_CODE,
                aeStartTime : itemStartTime,
                aeEndTime : itemEndTime,
                sectionNumber : entry.SECTION_NUMBER,
                building : build,
                room : room,
                className : eventClass,
                capacity : entry.SCTN_CPCTY_QTY,
                available : seatsAvailable,
                wtcount : wtcount,
                startDate : entry.START_DATE

            });
        }

        eventViews.push({
            sectionHead : sectionHead,
            time : timeConvSE(entry.BEGIN_HH_TIME, entry.BEGIN_MM_TIME, entry.END_HH_TIME, entry.END_MM_TIME),
            building : build,
            room : room,
            status : entry.ENROLL_STATUS,
            sectionCode : entry.SECT_CODE,
            subjCrse : subjCrse,
            days : entry.DAY_CODE,
            sectionNumber : entry.SECTION_NUMBER,
            title : entry.CRSE_TITLE,
            units : entry.SECT_CREDIT_HRS,
            grade : entry.GRADE_OPTION,
            type : entry.FK_CDI_INSTR_TYPE,
            id : itemId,
            subjCode : entry.SUBJ_CODE,
            crseCode : entry.CRSE_CODE,
            duplicate : (entry.DUPLICATE != undefined),
            wtposition : entry.WT_POS,
            subtitle : entry.LONG_DESC,
            capacity : entry.SCTN_CPCTY_QTY,
            available : seatsAvailable,
            wtcount : wtcount
        });

        if ($.inArray(sectionHead, sectionHeads) == -1)
        {
            sectionHeads.push(sectionHead);
        }
    });

    /*
     * Combine courses for dialog display
     */
    var eventViewsClone = $.extend(true, [], eventViews);
    eventGroupMap = {};
    eventGroupMap.length = 0;
    $.each(sectionHeads, function(i, sectionHead)
    {

        var eventGroup = [];
        eventGroup.length = 0;
        $.each(eventViews, function(j, event)
        {

            if (event.sectionHead == sectionHead)
            {
                var updated = false;
                $.each(eventGroup, function(k, inner)
                {

                    if (inner.sectionCode == event.sectionCode)
                    {

                        if (inner.time == event.time
                            && inner.building == event.building
                            && inner.room == event.room)
                        {
                            // combine days
                            inner.days = inner.days.toString()
                                + event.days.toString();
                            updated = true;
                            return false;
                        }
                    }
                });
                if (!updated)
                {
                    eventGroup.push(event);
                }
            }
        });
        eventGroupMap[sectionHead] = eventGroup;
    });

    // create special entry for duplicate sections
    $.each(duplicateCalSections, function(i, entry)
    {
        if (eventGroupMap[entry.SECTION_NUMBER
            + entry.ENROLL_STATUS] != undefined) return;
        var eventGroup = [];
        eventGroup.length = 0;
        var first = true;
        var topEntry = undefined;
        for ( var head in eventGroupMap)
        {

            var found = false;
            var currentHead = undefined;
            $.each(eventGroupMap[head], function(j, inner)
            {
                if (entry.ENROLL_STATUS != inner.status)
                {
                    return false;
                } // only group duplicates of same status
                if (head == inner.sectionNumber)
                {
                    currentHead = inner;
                }
                if (entry.SECTION_NUMBER == inner.sectionNumber)
                {
                    topEntry = inner;
                    found = true;
                }
            });
            if (first
                && topEntry != undefined)
            {
                eventGroup.push(topEntry);
                first = false;
            }
            if (found
                && currentHead != undefined)
            {
                eventGroup.push(currentHead);
            }
        }
        if (eventGroup.length > 0)
        {
            eventGroupMap[entry.SECTION_NUMBER
                + entry.ENROLL_STATUS] = eventGroup;
        }
    });

    // make the calendar titles
    $.each(eventViewsClone, function(index, event)
    {
        if (event.duplicate) return;
        var key = event.sectionHead;
        // if duplicate "00" type then need to use different data
        $.each(duplicateCalSections, function(i, entry)
        {
            if (entry.SECTION_NUMBER == event.sectionNumber
                && entry.ENROLL_STATUS == event.status)
            {
                key = event.sectionNumber
                    + event.status;
                return false;
            }
        });

        $('#calendar-id').on('click', '#calendar-title-event-id-'
            + event.id, function()
        {
            classCalView(eventGroupMap[key], event.id);
        });
    });

    calTba = {};
    calTba = null;
    callback(classEvents);
}

/*
 * Setup dialog for class view on calendar.
 */
function classCalView(events, id)
{

    if ($('#calendar-title-event-id-'
        + id).hasClass('calendar-course-title-hidden'))
    {
        return;
    }

    var isWaitlist = (events[0].status == 'WT');
    // handle waitlist position/count column header
    $("#diagview-wtcount-header").empty();
    $("#diagview-wtcount-header").text(isWaitlist ? "Waitlist Position" : "Waitlist Count");

    $("#diagview-class-table-subj").empty();
    $("#diagview-class-table-title").empty();
    $("#diagview-class-table-grade-p").empty();
    $("#diagview-class-table-unit-p").empty();
    $("#diagview-class-table-code").empty();
    $("#diagview-class-table-type").empty();
    $("#diagview-class-table-days").empty();
    $("#diagview-class-table-time").empty();
    $("#diagview-class-table-seats").empty();
    $("#diagview-class-table-wtcount").empty();

    $('#dialog-view').dialog('open');
    removeTips();

    $('#diagview-class-table-subj').text(events[0].subjCrse);
    var thetitle = events[0].title;
    if (events[0].subtitle.trim() != "")
    {
        thetitle += " - "
            + events[0].subtitle;
    }
    $('#diagview-class-table-title').text(thetitle);
    $("#diagview-class-table-grade-p").text(gradeOptionConv(events[0].grade));
    $("#diagview-class-table-unit-p").text(events[0].units.toFixed(2));
    $('#diagview-class-table-code').text(events[0].sectionCode);
    $('#diagview-class-table-type').text(events[0].type);
    $('#diagview-class-table-days').text(dayConvNum2Str(events[0].days));
    $('#diagview-class-table-time').text(events[0].time);

    if (events.length == 1)
    {
        var seatsAvailable = events[0].available
            + "/"
            + events[0].capacity;
        $("#diagview-class-table-seats").text(seatsAvailable);
        if (isWaitlist)
        {
            $("#diagview-class-table-wtcount").text(events[0].wtposition);
        }
        else
        {
            $("#diagview-class-table-wtcount").text(events[0].wtcount);
        }
    }

    // add associated class rows
    var classInfo = $('#diagview-class-table');
    $('.diagview-class-table-no1234').remove();

    $.each(events.slice(1), function(index, entry)
    {

        rowDef = '<tr class="diagview-class-table-no1234" >';
        var seatsAvailable = entry.available
            + "/"
            + entry.capacity;
        var wtcountValue = "";
        if (isWaitlist)
        {
            wtcountValue = entry.wtposition;
        }
        else
        {
            wtcountValue = entry.wtcount;
        }
        classInfo.append(rowDef
            + '<td class="diagclass-class-table-empty"></td>'
            + '<td class="diagclass-class-table-empty"></td>'
            + '<td class="diagclass-class-table-empty"></td>'
            + '<td class="diagclass-class-table-empty"></td>'
            + '<td>'
            + entry.sectionCode
            + '</td>'
            + '<td>'
            + entry.type
            + '</td>'
            + '<td>'
            + dayConvNum2Str(entry.days)
            + '</td>'
            + '<td>'
            + entry.time
            + '</td>'
            + '<td>'
            + seatsAvailable
            + '</td>' // seats
            + '<td>'
            + wtcountValue
            + '</td>' // wt count / position
            + '</tr>');
    });

}

/*
 * Set up choosing dialogs for duplicate classes.
 */
function chooseSectionForAction(events, action)
{
    if ($('#calendar-title-event-id-'
        + events[0].id).hasClass('calendar-course-title-hidden'))
    {
        return;
    }
    $("#diagchoose-class-table-subj").empty();
    $("#diagchoose-class-table-title").empty();
    $("#diagchoose-class-table-grade-p").empty();
    $("#diagchoose-class-table-unit-p").empty();
    $("#diagchoose-class-table-code").empty();
    $("#diagchoose-class-table-type").empty();
    $("#diagchoose-class-table-days").empty();
    $("#diagchoose-class-table-time").empty();
    $("#diagchoose-class-table-seats").empty();
    $("#diagchoose-class-table-wtcount").empty();
    $("#diagchoose-class-table-action").empty();

    $('#dialog-choose').dialog('open');
    removeTips();

    $('#diagchoose-class-table-subj').text(events[0].subjCrse);
    $('#diagchoose-class-table-title').text(events[0].title);
    $("#diagchoose-class-table-grade-p").text(gradeOptionConv(events[0].grade));
    $("#diagchoose-class-table-unit-p").text(events[0].units.toFixed(2));
    $('#diagchoose-class-table-code').text(events[0].sectionCode);
    $('#diagchoose-class-table-type').text(events[0].type);
    $('#diagchoose-class-table-days').text(dayConvNum2Str(events[0].days));
    $('#diagchoose-class-table-time').text(events[0].time);

    updateTips("<strong>Which section would you like to perform this action on?</strong>");
    // add associated class rows
    var classInfo = $('#diagchoose-class-table');
    $('.diagview-class-table-no1234').remove();

    $.each(events.slice(1), function(index, entry)
    {

        var isEnrollAllow = false;
        if (entry.status == 'PL')
        { // can only enroll from PL sections

            if (undefined != planSectNumEnrollDetail[entry.sectionNumber])
            {
                isEnrollAllow = isEnrollOrWaitBut(
                    entry.sectionNumber,
                    planSectNumEnrollDetail[entry.sectionNumber].AVAIL_SEAT,
                    planSectNumEnrollDetail[entry.sectionNumber].STP_ENRLT_FLAG,
                    entry.subjCode,
                    entry.crseCode);
            }
        }
        rowDef = '<tr class="diagview-class-table-no1234" >';

        var seatsAvailable = entry.available
            + "/"
            + entry.capacity;
        var wtcountValue = entry.wtcount;

        var buttonId = 'choose-button-event-'
            + entry.id;
        var buttonValue = "";

        switch (action)
        {
            case 'change':
                buttonValue = 'Change';
                break;
            case 'drop':
                buttonValue = 'Drop';
                break;

            case 'waitlist':
            case 'enroll':
                buttonValue = (isEnrollAllow) ? "Enroll" : "Waitlist";
                break;

            case 'removeplan':
                buttonValue = 'Remove';
                break;
        }

        classInfo.append(rowDef
            + '<td class="diagclass-class-table-empty"></td>'
            + '<td class="diagclass-class-table-empty"></td>'
            + '<td class="diagclass-class-table-empty"></td>'
            + '<td class="diagclass-class-table-empty"></td>'
            + '<td>'
            + entry.sectionCode
            + '</td>'
            + '<td>'
            + entry.type
            + '</td>'
            + '<td>'
            + dayConvNum2Str(entry.days)
            + '</td>'
            + '<td>'
            + entry.time
            + '</td>'
            + '<td>'
            + seatsAvailable
            + '</td>' // available seats
            + '<td>'
            + wtcountValue
            + '</td>' // waitlist count
            + '<td><input type="button"  id="'
            + buttonId
            + '" class="ui-button wrbutton wrbuttonc" value="'
            + buttonValue
            + '" /></td>'
            + '</tr>');

        switch (action)
        {

            case 'change':
                var classObj = {
                    data : {
                        objid : entry.id, sectionHead : entry.sectionHead, enStatus : entry.status
                    }
                };
                $('#'
                    + buttonId).click(function()
                {
                    classEditFun(classObj);
                    $('#dialog-choose').dialog('close');
                });
                break;
            case 'drop':

                var classObj = {
                    data : {
                        objid : entry.id, sectionHead : entry.sectionHead, enStatus : entry.status
                    }
                };
                $('#'
                    + buttonId).click(function()
                {
                    classDropFun(classObj);
                    $('#dialog-choose').dialog('close');
                });
                break;
            case 'waitlist':
            case 'enroll':

                $('#'
                    + buttonId).click(function()
                {
                    $('#dialog-choose').dialog('close');
                    classEnrollFun(entry.sectionHead, (isEnrollAllow) ? "enroll" : "wait", entry.subjCode, entry.crseCode, entry.title, undefined, undefined);
                });
                break;

            case 'removeplan':

                var classObj = {
                    data : {
                        actionTip : "<b style='font-size:16px' >Would you like to remove the following planned class?</b>", sectionHead : entry.sectionHead
                    }
                };

                $('#'
                    + buttonId).click(function()
                {

                    classPlanRemoveFun(classObj);
                    $('#dialog-choose').dialog('close');
                });
                break;
        }
    });
}

function getHourOfEventTime(eventTime)
{
    return (eventTime.charAt(0) == "0") ? eventTime.charAt(1) : eventTime.substring(0, 2);
}

/*
 * Gets the earliest start time and latest end time so the calendar can be
 * truncated
 */
function setupFullCalendarMinMax()
{

    // setup min and max calendar times
    calendarMinTime = "23";
    calendarMaxTime = "00";
    calEmpty = false;
    $.each(aeEventArr, function(index, entry)
    {
        var eventStartHour = entry.START_TIME.substring(0, 2);
        var eventEndHour = entry.END_TIME.substring(0, 2);
        if (eventStartHour < calendarMinTime)
        {
            calendarMinTime = eventStartHour;
        }
        if (eventEndHour > calendarMaxTime)
        {
            calendarMaxTime = eventEndHour;
        }
    });
    // update min max times
    calendarMinTime = calendarMinTime.substring(0, 2);
    calendarMaxTime = calendarMaxTime.substring(0, 2);

    var dataOrg = getCopyData(cGlobData);
    // filter relevant data
    var tmpObj = {};
    var data = [];
    data.length = 0;
    $.each(dataOrg, function(index, entry)
    {
        if (true == entry.PB_FRIEND)
        {
            return;
        }
        if ("PL" != entry.ENROLL_STATUS)
        {
            data.push(entry);
            return;
        }
        var key = entry.SECTION_NUMBER
            + entry.DAY_CODE
            + timeConvSE(entry.BEGIN_HH_TIME, entry.BEGIN_MM_TIME, entry.END_HH_TIME, entry.END_MM_TIME);
        if (!(key in tmpObj))
        {
            tmpObj[key] = true;
            data.push(entry);
        }
    });

    $.each(data, function(index, entry)
    {

        // get 2 digit time strings
        var beginHH = String("0"
            + entry.BEGIN_HH_TIME).slice(-2);
        var beginMM = String("0"
            + entry.BEGIN_MM_TIME).slice(-2);
        var endHH = String("0"
            + entry.END_HH_TIME).slice(-2);
        var endMM = String("0"
            + entry.END_MM_TIME).slice(-2);

        // get minTime and maxTime
        if (!(beginHH == 0
            && beginMM == 0
            && endHH == 0 && endMM == 0))
        {
            if (beginHH < calendarMinTime
                && beginHH != "00")
            {
                calendarMinTime = beginHH;
            }
            if (endHH > calendarMaxTime)
            {
                calendarMaxTime = endHH;
            }
        }
    });
    // if no events/classes in calendar
    if (calendarMinTime == "23"
        && calendarMaxTime == "00")
    {
        calendarMinTime = "7";
        calendarMaxTime = "7";
        calEmpty = true;
    }
}

var alwaysDisableClass = "alwaysdisable";
function disableCalendarButton(classNameWithDot, titleMsg)
{
    $(classNameWithDot).button().button('disable');
    $(classNameWithDot).button().addClass(alwaysDisableClass);
    $(classNameWithDot).attr('title', titleMsg);
}
;

function restrictCalendarButtons()
{
    if (!editAble)
    {
        disableCalendarButton('.cal-edit-class', notEditableMsg);
    }

    if (!dropAble)
    {
        disableCalendarButton('.cal-drop-class', notDropableMsg);
    }
    if (!waitlistAble)
    {
        disableCalendarButton('.cal-plan-wait-class', notWaitlistableMsg);
    }

    // personal restriction
    if (got56or64)
    { // disable all button except plan remove
        disableCalendarButton('.cal-eddr-class', got56or64Msg);
        disableCalendarButton('.cal-plan-enwt-class', got56or64Msg);
    }
    else if (!enrollAddIsTodayBetween)
    { // don't allow enroll
        disableCalendarButton('.cal-plan-enwt-class', notEnrollableMsg);
    }

    if (gotFtype)
    {
        disableCalendarButton('.noMoreEnWtCalClass', gotFtypeMsg);
    }

    if (gotMD)
    {
        // disable everything but event buttons
        disableCalendarButton('.wrbuttonc', gotMDMsg);

        $('.cal-event-class-but').button().button('enable');
        $('.cal-event-class-but').button().removeClass(alwaysDisableClass);
        $('.cal-event-class-but').removeAttr('title');
    }
}

/*
 * Builds the weekly calendar.
 */
function buildCalendar()
{

    var elementTimeList = [];

    /*
     * There's no way to reset elementTimeList before rendering which causes the
     * list to have duplicates. This copy allows us to reset elementTimeList but
     * keep the data for eventClick.
     */
    var elementTimeListClick = [];

    // process events/classes for calendar size
    setupFullCalendarMinMax();

    $('#calendar-id').empty();
    $('#calendar-id').fullCalendar(
        {

            slotEventOverlap : true,

            defaultView : 'agendaWeek',
            header : {
                left : false, center : false, right : false
            },
            columnFormat : {
                week : 'dddd'
            }, // week view column header

            height : 9999,
            axisFormat : (calEmpty) ? '' : 'htt',

            editable : false, // drag and drop enable
            theme : true,
            allDaySlot : false,
            allDayDefault : false, // disable allday slot

            weekends : true,
            slotMinutes : 30,
            firstDay : 1,
            minTime : parseInt(getHourOfEventTime(calendarMinTime)),
            maxTime : parseInt(getHourOfEventTime(calendarMaxTime)) + 1,

            ignoreTimezone : false, // important
            defaultEventMinutes : 50,

            events : function(start, end, callback)
            {
                if (cGlobData != null)
                {
                    var data = getCopyData(cGlobData);
                    getClassCalFun(aeEventArr, data, start, end, callback);
                }
                else
                {
                    var tmpSched = enrollAddIsTodayFuture ? null : schedCur;
                    wrapperGetClass(tmpSched, '', '', function(data)
                    {
                        cGlobData = data;
                        getClassCalFun(aeEventArr, getCopyData(cGlobData), start, end, callback);
                    });
                }
            },

            eventClick : function(event, jsEvent, view)
            {
                $(this).css('z-index', 99);

                if ($(this).hasClass('event-div-hidden'))
                {
                    jsEvent.stopPropagation();
                }
                $(this).removeClass('event-div-hidden');

                var elementTimeList = elementTimeListClick;

                var cloneTimeList = $.extend(true, [], elementTimeList);
                var currentEventId = $(this).attr('id').substring(16);
                var currentElemTimeObj;

                // find current element time obj
                $.each(cloneTimeList, function(index, entry)
                {
                    if (entry.id == currentEventId)
                    {
                        currentElemTimeObj = entry;
                        cloneTimeList.splice(index, 1);
                        return false;
                    }
                });

                // disable conflicting event buttons and place to back
                $.each(cloneTimeList, function(index, entry)
                {
                    if (entry.day == currentElemTimeObj.day)
                    {
                        if (entry.start < currentElemTimeObj.end
                            && currentElemTimeObj.start < entry.end)
                        {

                            // conflict so disable buttons
                            $('.fc-event-button-class-'
                                + entry.id).button().button('disable');
                            entry.element.css('z-index', 0);

                            // set class to hidden
                            if (!$('#fc-event-div-id-'
                                + entry.id).hasClass('event-div-hidden'))
                            {
                                $('#fc-event-div-id-'
                                    + entry.id).addClass('event-div-hidden');
                            }

                            // disable calendar click
                            if ($('#calendar-title-event-id-'
                                + entry.id).length)
                            {
                                // unbind
                                $('#calendar-id').off('click', '#calendar-title-event-id-'
                                    + entry.id, classCalView);

                                if (!$('#calendar-title-event-id-'
                                    + entry.id).hasClass('calendar-course-title-hidden'))
                                {
                                    $('#calendar-title-event-id-'
                                        + entry.id).addClass('calendar-course-title-hidden');
                                }
                            }

                        }
                    }
                });

                // enable current element buttons if they can be
                $('.fc-event-button-class-'
                    + currentEventId).button().button('enable');
                $("."
                    + alwaysDisableClass).button().button('disable');

                if ($('#calendar-title-event-id-'
                    + currentEventId).length)
                {
                    var key = currentElemTimeObj.sectionHead;
                    // if duplicate "00" type then need to use different data
                    $.each(duplicateCalSections, function(i, entry)
                    {
                        if (entry.SECTION_NUMBER == currentElemTimeObj.section
                            && entry.ENROLL_STATUS == currentElemTimeObj.status)
                        {
                            key = event.sectionNumber
                                + currentElemTimeObj.status;
                            return false;
                        }
                    });
                    // rebind
                    $('#calendar-id').on('click', '#calendar-title-event-id-'
                        + event.id, function()
                    {
                        classCalView(eventGroupMap[key], event.id);
                    });
                    $('#calendar-title-event-id-'
                        + currentEventId).removeClass('calendar-course-title-hidden');
                }

            },

            eventAfterAllRender : function(view)
            {
                $('#calendar-id .fc-today').removeClass('ui-state-highlight');

                /*
                 * Disable buttons for events that aren't at front
                 */
                $.each(elementTimeList, function(i, outer)
                {

                    var last = outer;
                    $.each(elementTimeList.slice(i + 1), function(j, inner)
                    {

                        // check for conflicts
                        if (outer.day == inner.day
                            && outer.section != inner.section
                            && outer.startDate == inner.startDate)
                        {
                            if (outer.start < inner.end
                                && inner.start < outer.end)
                            {
                                last = inner;
                                if (inner.status != 'EV'
                                    && outer.status != 'EV')
                                {
                                    if (!inner.element.hasClass('conflict-cal-event'))
                                    {
                                        inner.element.addClass('conflict-cal-event');
                                    }
                                    if (!outer.element.hasClass('conflict-cal-event'))
                                    {
                                        outer.element.addClass('conflict-cal-event');
                                    }
                                }
                            }
                        }
                    });
                    outer.top = (last == outer);
                });

                $.each(elementTimeList, function(index, entry)
                {
                    if (!entry.top)
                    {
                        // not top so disable buttons
                        $('.fc-event-button-class-'
                            + entry.id).button().button('disable');

                        // set class to hidden
                        if (!$('#fc-event-div-id-'
                            + entry.id).hasClass('event-div-hidden'))
                        {
                            $('#fc-event-div-id-'
                                + entry.id).addClass('event-div-hidden');
                        }

                        // disable calendar click
                        $('#calendar-id').off('click', '#calendar-title-event-id-'
                            + entry.id, classCalView);

                        if (!$('#calendar-title-event-id-'
                            + entry.id).hasClass('calendar-course-title-hidden'))
                        {
                            $('#calendar-title-event-id-'
                                + entry.id).addClass('calendar-course-title-hidden');
                        }

                    }
                });

                restrictCalendarButtons();

                // copy it to keep the data but also need to reset the data for
                // the next time
                // the events are rendered so duplicate data isn't added
                elementTimeListClick = $.extend(true, [], elementTimeList);
                elementTimeList = [];
                elementTimeList.length = 0;
            },

            eventAfterRender : function(event, element, view)
            {
                if ($(element).css('width').replace(/px/i, '') < 100)
                {
                    $(element).css('width', '100px');
                }
            },

            eventRender : function(event, element, view)
            {

                element.find('.fc-event-title').html(event.title);

                element.attr('id', 'fc-event-div-id-'
                    + event.id);

                // anything not defined in event obj will be set to undefined
                var eventId = event.id;
                var sectionHead = event.sectionHead;
                var subjCode = event.subjCode;
                var crseCode = event.crseCode;
                var stitle = event.stitle;
                var gradeVal = event.gradeVal;
                var unitVal = event.unitVal;

                var enStatus = event.enStatus; // EN code
                var enStatus0 = undefined;
                var enStatus1 = undefined;

                var aeName = event.aeName;
                var aeDay = event.aeDay;
                var aeDays = event.aeDays;
                var aeLocation = event.aeLocation;
                var aeStartTime = event.aeStartTime;
                var aeEndTime = event.aeEndTime;
                var aeTimeStamp = event.aeTimeStamp;
                var sectionNumber = event.sectionNumber
                    || "";

                var tempList = [];

                elementTimeList.push({
                    id : event.id,
                    element : element,
                    status : enStatus,
                    day : aeDay,
                    start : aeStartTime,
                    end : aeEndTime,
                    section : sectionNumber,
                    sectionHead : sectionHead,
                    startDate : event.startDate
                });

                switch (enStatus)
                {
                    case "EN":
                        enStatus0 = 0;
                        enStatus1 = "Enrolled";
                        break;
                    case "WT":
                        enStatus0 = 1;
                        enStatus1 = "Waitlist";
                        break;
                    case "PL":
                        enStatus0 = 2;
                        enStatus1 = "Planned";
                        break;
                    case "EV":
                        enStatus0 = 3;
                        enStatus1 = "Event";
                        break;
                }

                var thisGradeEnable = event.gradeEnable; // true or false
                var thisUnitEnable = event.unitEnable; // true or false

                var iHtml = element[0].innerHTML;

                iHtml = iHtml.replace(/fc-event-time">([^<]+)<\/div>/, "fc-event-time\">"
                    + "<span> $1</span>"
                    + "<span class='fc-local-enstatus' > "
                    + enStatus1
                    + "</span>"
                    + "</div>");

                switch (enStatus0)
                {
                    case 0:
                        var calStatusClass = " wrbuttonc cal-enroll-class-but ";
                        break;
                    case 1:
                        var calStatusClass = " wrbuttonc cal-wait-class-but ";
                        break;
                    case 2:
                        var calStatusClass = " wrbuttonc cal-plan-class-but ";
                        break;
                    case 3:
                        var calStatusClass = " wrbuttonc cal-event-class-but ";
                        break;
                    default:
                        var calStatusClass = " wrbuttonc ";
                        break;
                }

                var calButEdit = undefined;
                var calButDrop = undefined;

                var idEdit = "cal-edit-id-"
                    + eventId;
                var idDrop = "cal-drop-id-"
                    + eventId;

                var idPlanEnroll = "cal-plan-enroll-id-"
                    + eventId;
                var idPlanWait = "cal-plan-wait-id-"
                    + eventId;
                var idPlanRemove = "cal-plan-remove-id-"
                    + eventId;

                var idEventEdit = "cal-event-edit-id-"
                    + eventId;
                var idEventRemove = "cal-event-remove-id-"
                    + eventId;

                var buttonEventClass = 'fc-event-button-class-'
                    + event.id;

                // need to handle duplicate sections
                var duplicate = false;
                // if duplicate "00" type then need to use different data
                $.each(duplicateCalSections, function(i, entry)
                {
                    if (entry.SECTION_NUMBER == event.sectionNumber
                        && entry.ENROLL_STATUS == event.enStatus)
                    {

                        duplicate = true;
                        return false;
                    }
                });

                if (2 == enStatus0)
                {
                    var isEnrollAllow = false;
                    if (duplicate)
                    {
                        var key = event.sectionNumber
                            + event.enStatus;
                        var events = eventGroupMap[key];
                        $.each(events.slice(1), function(index, entry)
                        {
                            if (undefined != planSectNumEnrollDetail[entry.sectionNumber])
                            {
                                var tmpCheck = isEnrollOrWaitBut(
                                    entry.sectionNumber,
                                    planSectNumEnrollDetail[entry.sectionNumber].AVAIL_SEAT,
                                    planSectNumEnrollDetail[entry.sectionNumber].STP_ENRLT_FLAG,
                                    entry.subjCode,
                                    entry.crseCode);
                                if (tmpCheck)
                                {
                                    isEnrollAllow = true;
                                    return false;
                                }
                            }
                        });

                    }
                    else
                    {
                        if (undefined != planSectNumEnrollDetail[sectionHead])
                        {
                            isEnrollAllow = isEnrollOrWaitBut(
                                sectionHead,
                                planSectNumEnrollDetail[sectionHead].AVAIL_SEAT,
                                planSectNumEnrollDetail[sectionHead].STP_ENRLT_FLAG,
                                subjCode,
                                crseCode);
                        }
                    }

                    if (isAlreadyExist(undefined, subjCode, crseCode, 'EN')[0])
                    { // enrolled
                        var optClass = " noMoreEnWtCalClass ";
                    }
                    else
                    {
                        var optClass = "";
                    }

                    // button - calendar
                    if (isEnrollAllow)
                    {
                        calButEdit = "<input type='button'  id='"
                            + idPlanEnroll
                            + "' "
                            + " class='ui-button wrbutton wrbuttonc wrbuttoncr secondary cal-plan-enwt-class cal-plan-enroll-class "
                            + calStatusClass
                            + optClass
                            + " "
                            + buttonEventClass
                            + " ' "
                            + "value='Enroll' />";
                    }
                    else
                    {
                        calButEdit = "<input type='button'  id='"
                            + idPlanWait
                            + "' "
                            + " class='ui-button wrbutton wrbuttonc wrbuttoncr secondary cal-plan-enwt-class cal-plan-wait-class "
                            + calStatusClass
                            + optClass
                            + " "
                            + buttonEventClass
                            + " ' "
                            + " value='Waitlist' />";
                    }
                    calButDrop = "<input type='button'  id='"
                        + idPlanRemove
                        + "' "
                        + " class='ui-button wrbutton wrbuttonc wrbuttoncl secondary cal-plan-remove-class "
                        + calStatusClass
                        + " "
                        + buttonEventClass
                        + " ' "
                        + " value='Remove' />";

                }
                else if (3 == enStatus0)
                { // event

                    calButEdit = "<input type='button'  id='"
                        + idEventEdit
                        + "' "
                        + " class='ui-button wrbutton wrbuttonc wrbuttoncr secondary cal-event-class cal-event-edit-class "
                        + calStatusClass
                        + " "
                        + buttonEventClass
                        + " ' "
                        + " ' value='Change' />";

                    calButDrop = "<input type='button'  id='"
                        + idEventRemove
                        + "' "
                        + " class='ui-button wrbutton wrbuttonc wrbuttoncl secondary cal-event-class cal-event-remove-class "
                        + calStatusClass
                        + " "
                        + buttonEventClass
                        + " ' "
                        + " ' value='Remove' />";

                }
                else
                {
                    calButEdit = "<input type='button'  id='"
                        + idEdit
                        + "' "
                        + " class='ui-button wrbutton wrbuttonc wrbuttoncr secondary cal-eddr-class cal-edit-class "
                        + calStatusClass
                        + " "
                        + buttonEventClass
                        + " ' "
                        + " ' value='Change' />";

                    calButDrop = "<input type='button'  id='"
                        + idDrop
                        + "' "
                        + " class='ui-button wrbutton wrbuttonc wrbuttoncl secondary cal-eddr-class cal-drop-class "
                        + calStatusClass
                        + " "
                        + buttonEventClass
                        + " ' "
                        + " ' value='Drop' />";
                }

                var calButGroup = calButDrop
                    + calButEdit;
                if (isIE8)
                {
                    iHtml = iHtml.replace(/(<\/div>)\s*(<\/div>)/i, "$1"
                        + calButGroup
                        + "$2");
                }
                else
                {
                    iHtml = iHtml.replace(/(<\/div>)\s*(<\/div>)/, "$1"
                        + calButGroup
                        + "$2");
                }

                element[0].innerHTML = iHtml;

                // enroll/waitlist
                var classObj = {
                    objid : event.id, sectionHead : sectionHead, enStatus : enStatus
                };

                if (duplicate)
                {
                    var key = event.sectionNumber
                        + event.enStatus;
                    if (!thisGradeEnable
                        && !thisUnitEnable)
                    {
                        $('#'
                            + idEdit).button().button('disable');
                        $('#'
                            + idEdit).button().addClass(alwaysDisableClass);
                        $('#'
                            + idEdit).button().attr('title', noChangeTitle);
                    }
                    else
                    {
                        $('#'
                            + idEdit).click(function()
                        {
                            chooseSectionForAction(eventGroupMap[key], "change");
                        });
                    }
                    $('#'
                        + idDrop).click(function()
                    {
                        chooseSectionForAction(eventGroupMap[key], "drop");
                    });
                    // plan
                    $('#'
                        + idPlanEnroll).click(function()
                    {
                        chooseSectionForAction(eventGroupMap[key], "enroll");
                    });

                    $('#'
                        + idPlanWait).click(function()
                    {
                        chooseSectionForAction(eventGroupMap[key], "waitlist");
                    });

                    $('#'
                        + idPlanRemove).click(function()
                    {
                        chooseSectionForAction(eventGroupMap[key], "removeplan");
                    });
                    return;
                }

                if (!thisGradeEnable
                    && !thisUnitEnable)
                {
                    $('#'
                        + idEdit).button().button('disable');
                    $('#'
                        + idEdit).button().addClass(alwaysDisableClass);
                    $('#'
                        + idEdit).button().attr('title', noChangeTitle);
                }
                else
                {
                    $('#'
                        + idEdit).click(classObj, classEditFun);
                }
                $('#'
                    + idDrop).click(classObj, classDropFun);

                // plan
                $('#'
                    + idPlanEnroll).click(function()
                {
                    classEnrollFun(sectionHead, "enroll", subjCode, crseCode, stitle, undefined, undefined);
                });

                $('#'
                    + idPlanWait).click(function()
                {
                    classEnrollFun(sectionHead, "wait", subjCode, crseCode, stitle, undefined, undefined);
                });

                var classObjPlanRm = {
                    actionTip : "<b style='font-size:16px' >Would you like to remove the following planned class?</b>", sectionHead : sectionHead
                };

                $('#'
                    + idPlanRemove).click(classObjPlanRm, classPlanRemoveFun);

                // event
                var classEventObj = {
                    objid : event.id,
                    aeName : aeName,
                    aeDay : aeDay,
                    aeDays : aeDays,
                    aeLocation : aeLocation,
                    aeStartTime : aeStartTime,
                    aeEndTime : aeEndTime,
                    aeTimeStamp : aeTimeStamp
                };

                $('#'
                    + idEventEdit).click(classEventObj, eventEditFun);
                $('#'
                    + idEventRemove).click(classEventObj, eventRemoveFun);
            }
        });

}
buildCalendar();

// PBF for calendar
function calendarPBBuildAll()
{

    if (0 == cLocalDataPBF.length)
    {
        $("#calendar-id-pb").jqGrid("clearGridData", true);
        $("#calendar-id-pb-div").hide();
        return;
    }
    $("#calendar-id-pb-div").show();
    $("#calendar-id-pb").jqGrid("clearGridData", true);

    $('#calendar-id-pb').jqGrid(
        {
            caption : "Additional Sessions & Meetings",
            datatype : "local",
            height : '100%',
            // autowidth: true, //
            shrinkToFit : true,
            gridview : true,
            loadonce : true,
            sortable : true,
            rowNum : 100,
            hidegrid : false,
            viewrecords : true,
            cmTemplate : {
                title : false
            },

            beforeSelectRow : function(rowid, e)
            {
                return false; // lose focus
            },

            onRightClickRow : function()
            {
                $("#calendar-id-pb").jqGrid('resetSelection');
                return false;
            },

            colNames : [ 'Subject Course', 'Title', 'Status', 'Day', 'Date', 'Time', 'Building', 'Room', '' // IE8
            // COMPATIBILITY
            , 'RowAttr', 'enStatus' ],

            colModel : [
                {
                    name : 'PBF_SUBJ_CRSE', jsonmap : "PBF_SUBJ_CRSE", fixed : true, width : 100, align : 'left', editable : false, sortable : false
                },
                {
                    name : 'PBF_TITLE', jsonmap : "PBF_TITLE", fixed : true, width : 200, align : 'left', editable : false, sortable : false
                },
                {
                    name : 'PBF_STATUS', jsonmap : "PBF_STATUS", fixed : true, width : 80, align : 'center', editable : false, sortable : false
                },
                {
                    name : 'PBF_DAY', jsonmap : "PBF_DAY", fixed : true, width : 40, align : 'center', editable : false, sortable : false
                },
                {
                    name : 'PBF_DATE', jsonmap : "PBF_DATE", fixed : true, width : 100, align : 'center', editable : false, sortable : false
                },
                {
                    name : 'PBF_TIME', jsonmap : "PBF_TIME", fixed : true, width : 100, align : 'center', editable : false, sortable : false
                },
                {
                    name : 'PBF_BLDG',
                    jsonmap : "PBF_BLDG",
                    fixed : true,
                    width : 80,
                    align : 'center',
                    editable : false,
                    sortable : false,
                    formatter : gridMapFormat,
                    cellattr : gridTTBuilding
                },
                {
                    name : 'PBF_ROOM',
                    jsonmap : "PBF_ROOM",
                    fixed : true,
                    width : 80,
                    align : 'center',
                    editable : false,
                    sortable : false,
                    formatter : gridMapFormatRoomCellPBF,
                    cellattr : gridTTBuilding
                },
                {
                    name : 'nothing', fixed : true, width : 40, align : 'center', editable : false, sortable : false, hidden : !isIE8
                } // IE8 COMPATIBILITY
                ,
                {
                    name : 'ROW_ATTR', hidden : true
                },
                {
                    name : 'ENROLL_STATUS', hidden : true, jsonmap : "ENROLL_STATUS"
                } // for gridMapFormat
            ],

            rowattr : function(rd)
            {
                var res = '';
                var attr = rd.ROW_ATTR;
                if (undefined != attr)
                {
                    if (undefined != rd.ROW_ATTR.rowClass)
                    {
                        res = {
                            "class" : rd.ROW_ATTR.rowClass
                        };
                    }
                }
                return res;
            }
        });

    var gridObjPb = $("#calendar-id-pb");
    $.each(cLocalDataPBF, function(index, entry)
    {
        var rowId = index;

        gridObjPb.jqGrid('addRowData', rowId, entry);

        // handler
        if (undefined != entry.PBF_HEAD
            && entry.PBF_HEAD.match(/HEADER_/))
        {

            var sessionName = entry.PBF_HEAD.substring(7);
            var thisTitle = "<div class='wr-pbfrow-header-outer-class' id='wr-pbfrow-header-outer-id-"
                + rowId
                + "'><img class='wr-pbfrow-header-class' id='wr-pbfrow-header-id-"
                + rowId
                + "' alt='Expand: ' src='"
                + imgRight
                + "' "
                + " style=' width:8px; height:8px; margin-right: 2px; margin-top: 5px;' ></img> "
                + sessionName
                + "</div>";

            gridObjPb.jqGrid('setCell', rowId, 'PBF_TITLE', thisTitle);

            var sHSN = entry.SECTION_HEAD
                + ""
                + entry.SECTION_NUMBER;
            $("#wr-pbfrow-header-outer-id-"
                + rowId).click(function()
            {
                var curImgSrc = $("#wr-pbfrow-header-id-"
                    + rowId).attr('src');
                if (curImgSrc === imgDown)
                {
                    $("#wr-pbfrow-header-id-"
                        + rowId).attr('src', imgRight);
                    $(".wr-pbfrow-class-"
                        + entry.PBF_INFO
                        + "-"
                        + entry.PBF_MTYPE
                        + "-"
                        + sHSN).addClass('grid-row-hidden');
                }
                else
                {
                    $("#wr-pbfrow-header-id-"
                        + rowId).attr('src', imgDown);
                    $(".wr-pbfrow-class-"
                        + entry.PBF_INFO
                        + "-"
                        + entry.PBF_MTYPE
                        + "-"
                        + sHSN).removeClass('grid-row-hidden');
                }
            });
        }

        var rowEle = $("#calendar-id-pb tbody tr#"
            + rowId);
        switch (entry.ENROLL_STATUS)
        {
            case 'EN':
                rowEle.addClass('wr-grid-en');
                break;
            case 'WT':
                rowEle.addClass('wr-grid-wt');
                break;
            case 'PL':
                rowEle.addClass('wr-grid-pl');
                break;
        }

    });
    $(".wr-pbfrow-class").addClass('grid-row-hidden');
}
calendarPBBuildAll();

// final -------------------------------------------------------------

function getClassCalFinalFun(dataOrg, start, end, callback)
{

    // filter
    var tmpObj = {};
    var data = [];
    data.length = 0;
    $.each(dataOrg, function(index, entry)
    {
        if (!entry.FK_SPM_SPCL_MTG_CD.match(/FI/))
        {
            return;
        }
        var key = entry.SECTION_NUMBER
            + entry.DAY_CODE
            + entry.ENROLL_STATUS
            + timeConvSE(entry.BEGIN_HH_TIME, entry.BEGIN_MM_TIME, entry.END_HH_TIME, entry.END_MM_TIME);
        if (!(key in tmpObj))
        {
            tmpObj[key] = true;
            data.push(entry);
        }
    });
    tmpObj = {};
    tmpObj = null;

    var classEvents = [];
    var idBase = new Date().getTime();
    timeObjArrFinal = [];
    timeObjArrFinal.length = 0;

    var sat2Date = undefined;
    $.each(data, function(index, entry)
    {
        var itemId = Number(idBase)
            + index;

        var day = entry.DAY_CODE;

        // set first sat day to sunday so it'll display correctly
        if (day == 6)
        {
            if (sat2Date == undefined)
            {
                wrapperGetFinalSat2(function(data)
                {
                    sat2Date = data.DATE;
                });
            }
            if (undefined != sat2Date
                && entry.START_DATE.replace(/-/g, '') < sat2Date.replace(/-/g, ''))
            {
                day = 0;
            }
        }

        var beginHH = String("0"
            + entry.BEGIN_HH_TIME).slice(-2);
        var beginMM = String("0"
            + entry.BEGIN_MM_TIME).slice(-2);
        var endHH = String("0"
            + entry.END_HH_TIME).slice(-2);
        var endMM = String("0"
            + entry.END_MM_TIME).slice(-2);

        var itemStartTime = beginHH
            + ""
            + beginMM;
        var itemEndTime = endHH
            + ""
            + endMM;
        var itemStart = "9"
            + day
            + itemStartTime;
        var itemEnd = "9"
            + day
            + itemEndTime;

        var subj = entry.SUBJ_CODE
            + " "
            + entry.CRSE_CODE;
        var build = entry.BLDG_CODE;
        var room = entry.ROOM_CODE;

        timeObjArrFinal.push({
            subjCrse : subj, startTime : itemStartTime, endTime : itemEndTime, startDate : entry.START_DATE, // 2014-06-13
            dayCode : day
        // 0=Sun, 1=Mon, 6=Sat
        })

        // enStatusArr - final
        var enStatusArr = [];
        switch (entry.ENROLL_STATUS)
        {
            case "EN":
                enStatusArr[0] = 0;
                enStatusArr[1] = "Enrolled";
                break;
            case "WT":
                enStatusArr[0] = 1;
                enStatusArr[1] = "Waitlist";
                break;
            case "PL":
                enStatusArr[0] = 2;
                enStatusArr[1] = "Planned";
                break;
        }

        switch (enStatusArr[0])
        {
            case 0:
                var eventClass = enClass;
                break;
            case 1:
                var eventClass = wtClass;
                break;
            case 2:
                var eventClass = plClass;
                break;
        }

        // instructor final
        var instNamesTmp = entry.PERSON_FULL_NAME.split(':');
        var instNamesTip = ""
        var instNames = [];
        $.each(instNamesTmp, function(index, entry)
        {
            entry = entry.trim();
            if ($.inArray(entry, instNames) === -1)
            {
                instNames.push(entry);
                if (0 == index)
                {
                    instNamesTip = entry;
                }
                else
                {
                    instNamesTip = instNamesTip
                        + " / "
                        + entry;
                }
            }
        });

        $.each(instNames, function(index, entry)
        {
            if (entry.match(/^\s*staff\s*$/i))
            {
                return false;
            }
            if (index == 0)
            {
                instNames = entry;
            }
            else
            {
                instNames = instNames
                    + '<span title="'
                    + instNamesTip
                    + '"> + </span> ';
                return false;
            }
        });

        var startDate = dateConvFormat1(entry.START_DATE);

        // location
        if (finalLocationDisplay)
        {
            finalLocation = '<a target="_blank" class="nonewwin '
                + eventClass
                + ' " href="https://maps.ucsd.edu/?id=1005#!s/'
                + build.trim()+"_Main?ct/18312"
                + '">'
                + build.trim()
                + " "
                + room.trim()
                + '</a>\n';

        }
        else
        {
            finalLocation = "Location - TBA\n";
        }

        var itemTitle = "<br><b><em>"
            + startDate
            + "</em></b><br>"
            + "<br>"
            + subj
            + "<br>"
            + finalLocation
            + "<br>"
            + instNames;

        classEvents.push({
            id : itemId,
            start : dateConvDB2Cal(itemStart),
            end : dateConvDB2Cal(itemEnd),
            title : itemTitle,
            className : eventClass,
            enStatus1 : enStatusArr[1],
            sectionHead : entry.SECTION_HEAD,
            aeDay : day,
            aeStartTime : itemStartTime,
            aeEndTime : itemEndTime,
            sectionNumber : entry.SECTION_NUMBER,
            startDate : entry.START_DATE
        });
    });

    callback(classEvents);
}

// gets the earliest start time and latest end time
// so the calendar can be truncated
function getMinMaxFinals()
{
    // init globals
    finalMinTime = "23";
    finalMaxTime = "00";
    finalsEmpty = false;
    // filter
    var tmpObj = {};
    var dataOrg = getCopyData(cGlobData);
    var data = [];
    data.length = 0;
    $.each(dataOrg, function(index, entry)
    {
        if (!entry.FK_SPM_SPCL_MTG_CD.match(/FI/))
        {
            return;
        }
        var key = entry.SECTION_NUMBER
            + entry.DAY_CODE
            + entry.ENROLL_STATUS
            + timeConvSE(entry.BEGIN_HH_TIME, entry.BEGIN_MM_TIME, entry.END_HH_TIME, entry.END_MM_TIME);
        if (!(key in tmpObj))
        {
            tmpObj[key] = true;
            data.push(entry);
        }
    });
    tmpObj = {};
    tmpObj = null;

    $.each(data, function(index, entry)
    {

        // get 2 digit time strings
        var beginHH = String("0"
            + entry.BEGIN_HH_TIME).slice(-2);
        var beginMM = String("0"
            + entry.BEGIN_MM_TIME).slice(-2);
        var endHH = String("0"
            + entry.END_HH_TIME).slice(-2);
        var endMM = String("0"
            + entry.END_MM_TIME).slice(-2);

        // get minTime and maxTime
        if (!(beginHH == 0
            && beginMM == 0
            && endHH == 0 && endMM == 0))
        {
            if (beginHH < finalMinTime
                && beginHH != "00")
            {
                finalMinTime = beginHH;
            }
            if (endHH > finalMaxTime)
            {
                finalMaxTime = endHH;
            }
        }
    });
    // if no events/classes in calendar
    if (finalMinTime == "23"
        && finalMaxTime == "00")
    {
        finalMinTime = "7";
        finalMaxTime = "7";
        finalsEmpty = true;
    }
}

function setupColumnNames()
{
    var cols = [ 'Sat', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat' ];
    if (isSummerSession)
    {
        return cols;
    }
    var startDate = null;
    wrapperGetFinalSat2(function(data)
    {

        var dates = data.DATE.split("-");
        startDate = new Date(dates[0], dates[1] - 1, dates[2]);
        if (startDate.getDay() == 5)
        {
            // the date returned will be a friday in spring quarter and saturday
            // otherwise
            startDate.setDate(startDate.getDate() - 6);
        }
        else
        {
            startDate.setDate(startDate.getDate() - 7);
        }
    });
    $.each(cols, function(index, entry)
    {
        cols[index] += "\n"
            + (startDate.getMonth() + 1)
            + "/"
            + startDate.getDate()
            + "/"
            + startDate.getFullYear();
        if (index == 0)
        {
            startDate.setDate(startDate.getDate() + 2);
        }
        else
        {
            startDate.setDate(startDate.getDate() + 1);
        }
    });

    return cols;
}

function finalBuildAll()
{

    var elementTimeList = [];
    getMinMaxFinals();
    var columnNames = setupColumnNames();
    $('#finalcal-id').empty();
    $('#finalcal-id').fullCalendar({

        slotEventOverlap : true,

        defaultView : 'agendaWeek', header : {
            left : false, center : false, right : false
        }, columnFormat : {
            week : 'dddd'
        }, // week view column header

        dayNames : columnNames,

        height : 9999, axisFormat : (finalsEmpty) ? '' : 'htt',

        editable : false, // drag and drop enable
        theme : true, allDaySlot : false, allDayDefault : false, // diable allday slot

        weekends : true, slotMinutes : 30, firstDay : 0,

        minTime : parseInt(getHourOfEventTime(finalMinTime)), maxTime : parseInt(getHourOfEventTime(finalMaxTime)) + 1, ignoreTimezone : false, // important
        defaultEventMinutes : 50,

        events : function(start, end, callback)
        {
            var tmpSched = enrollAddIsTodayFuture ? null : schedCur;
            getClassCalFinalFun(getCopyData(cGlobData), start, end, callback);
        },

        eventAfterAllRender : function(view)
        {
            $('#finalcal-id .fc-today').removeClass('ui-state-highlight');

            /*
             * Add red border to conflicting finals
             */
            $.each(elementTimeList, function(i, outer)
            {

                $.each(elementTimeList.slice(i + 1), function(j, inner)
                {
                    // check for conflicts
                    if (outer.day == inner.day
                        && outer.section != inner.section
                        && outer.startDate == inner.startDate)
                    {
                        if (outer.start < inner.end
                            && inner.start < outer.end)
                        {
                            if (!inner.element.hasClass('conflict-cal-event'))
                            {
                                inner.element.addClass('conflict-cal-event');
                            }

                            if (!outer.element.hasClass('conflict-cal-event'))
                            {
                                outer.element.addClass('conflict-cal-event');
                            }

                        }
                    }
                });
            });
            elementTimeList = [];
            elementTimeList.length = 0;

        },

        eventAfterRender : function(event, element, view)
        {
            if ($(element).css('width').replace(/px/i, '') < 100)
            {
                $(element).css('width', '100px');
            }
        },

        eventRender : function(event, element, view)
        {
            // if called, re-render every other events in the calendar

            element.find('.fc-event-title').html(event.title);

            elementTimeList.push({
                id : event.id, element : element, day : event.aeDay, start : event.aeStartTime, end : event.aeEndTime, section : event.sectionNumber, startDate : event.startDate
            });

            var iHtml = element[0].innerHTML;

            // header - calendar cell final
            iHtml = iHtml.replace(/fc-event-time">([^<]+)<\/div>/, "fc-event-time\">"
                + "<span> $1</span>"
                + "<span class='fc-local-enstatus' > "
                + event.enStatus1
                + "</span>"
                + "</div>");

            element[0].innerHTML = iHtml;
        },

        eventClick : function(event, jsEvent, view)
        {
            $(this).siblings().css('z-index', 0);
            $(this).css('z-index', 99);
        }

    });
    finalPostProcess();

}
finalBuildAll();

// checks for saturday finals
function finalPostProcess()
{

    // conflicts for final
    var sat2Date = undefined;
    var finalSat1 = [];
    finalSat1.length = 0;
    var finalSat2 = [];
    finalSat2.length = 0;

    $.each(timeObjArrFinal, function(i, entry)
    {

        if (entry.dayCode == 0)
        {
            finalSat1.push(entry); // first sat
        }
        else if (entry.dayCode == 6)
        {
            finalSat2.push(entry); // second sat
        }
    });

    if (finalSat1.length > 0
        && !isSummerSession)
    { // display alert only if first Sat exists
        alertFromFinalSat = true;

        var finalSat1Msg = "";
        $.each(finalSat1, function(index, entry)
        {
            finalSat1Msg = finalSat1Msg
                + "<br>You have a final for "
                + entry.subjCrse
                + " on the First Saturday of Finals week on "
                + dateConvFormat2(entry.startDate);
        });
        finalSat1Msg = finalSat1Msg.replace(/<br>/, '');
        $("#wr-final-conflict-sat-1").html(finalSat1Msg);

        if (finalSat2.length > 0)
        {

            var finalSat2Msg = "";
            $.each(finalSat2, function(index, entry)
            {
                finalSat2Msg = finalSat2Msg
                    + "<br>You have a final for "
                    + entry.subjCrse
                    + " on the Second Saturday of Finals week on "
                    + dateConvFormat2(entry.startDate);
            });
            finalSat2Msg = finalSat2Msg.replace(/<br>/, '');
            $("#wr-final-conflict-sat-2").html(finalSat2Msg);

        }
    }
    else
    {
        alertFromFinalSat = false;
        $("#wr-final-conflict-sat-1").empty();
        $("#wr-final-conflict-sat-2").empty();
    }

}

// enroll -------------------------------------------------------------

$("#dialog-enroll").dialog({
    autoOpen : false, maxWidth : 1050, position : {
        my : "center", at : "center", of : window
    }, height : 'auto', width : 1050, modal : true, closeOnEscape : false, buttons : {

        Cancel : {
            text : "Cancel", click : function()
            {
                $(this).dialog("close");
            }
        },

        Confirm : {
            text : "Confirm", click : function()
            {
                $(this).dialog("close");
                var gradeVal = $('#diagenroll-class-table-grade option:selected').val();
                var unitVal = $('#diagenroll-class-table-unit option:selected').text();

                if (undefined == gradeVal
                    || gradeVal.trim() == '')
                {
                    gradeVal = gradeOptionDeConv($('#diagenroll-class-table-grade-p').text());
                }
                if (undefined == unitVal
                    || unitVal.trim() == '')
                {
                    unitVal = $('#diagenroll-class-table-unit-p').text();
                }

                var action = $(this).dialog('option', 'action');
                var subjCrse = $(this).dialog('option', 'subjcrse');
                var subjCode = $(this).dialog('option', 'subjcode');
                var crseCode = formatCrseCode($(this).dialog('option', 'crsecode'));
                var sectionHead = $(this).dialog('option', 'sectionhead');
                var buttonRowId = $(this).dialog('option', 'buttonrowid');

                var fromEnrollmentGrid = $(this).dialog('option', 'fromEnrollmentGrid');

                unitVal = Number(unitVal).toFixed(2);

                var isWt = (action == 'enroll') ? false : true;
                classEnrollAddFun(isWt, sectionHead, gradeVal, unitVal, subjCode, crseCode, buttonRowId, fromEnrollmentGrid);
                return;
            }
        }
    }
});

function classEnrollAddFun(isWt, sectionHead, gradeVal, unitVal, subjCode, crseCode, buttonRowId, fromEnrollmentGrid)
{

    var crseCodeWellForm = formatCrseCode(crseCode);
    var subjCodeTrim = subjCode.trim();

    wrapperAddEnroll(isWt, sectionHead, gradeVal, unitVal, subjCodeTrim, crseCodeWellForm, function(data)
    {

        var tipMsg = "";
        var subjCrse = subjCode
            + " "
            + crseCode;
        var crseCodeTrim = crseCode.trim();

        if ('SUCCESS' == data.OPS)
        {
            var planErrMsg = "";

            wrapperPlanRemoveAll(sectionHead, function(data)
            {
                if ('SUCCESS' != data.OPS)
                {
                    planErrMsg = "<br><br><div class='msg alert'><h4>Warning</h4>The removal of the planned section was <b>unsuccessful</b></div>";
                }
            });

            rebuildTabs();
            updatePreAuthLinks();

            if (sGridObj[0].grid)
            {
                if (undefined != sLocalDataCurrentPage)
                {
                    sLocalDataLoaded[sLocalDataCurrentPage] = $.extend(true, [], sLocalData);
                    var jobDone = false;
                    var reSectionHead = new RegExp(sectionHead);
                    $.each(sLocalDataLoaded, function(i, thisPage)
                    {
                        if (undefined == thisPage
                            || 0 == thisPage.length)
                        {
                            return;
                        }
                        $.each(thisPage, function(j, thisRow)
                        {

                            if (thisRow.SUBJ_CODE == subjCodeTrim
                                && thisRow.CRSE_CODE == crseCodeTrim)
                            {
                                if (undefined != thisRow.colaction
                                    && !thisRow.colaction.match(/^\s*$/))
                                {
                                    if (thisRow.colaction.match(/search-enroll-class/))
                                    {
                                        if (isWt)
                                        {
                                            thisRow.colaction = thisRow.colaction.replace(/disableSBWtClass/g, "");
                                            thisRow.colaction = thisRow.colaction.replace(/search-wait-class/, "search-wait-class disableSBWtClass ");
                                        }
                                        else
                                        {
                                            thisRow.colaction = thisRow.colaction.replace(/disableSBEnClass/g, "");
                                            thisRow.colaction = thisRow.colaction.replace(/search-enroll-class/, "search-enroll-class disableSBEnClass ");
                                        }
                                    }
                                }
                                if (thisRow.SECTION_NUMBER.toString().match(reSectionHead))
                                {
                                    thisRow.colaction = thisRow.colaction.replace(/disableSBSectionClass/g, "");
                                    thisRow.colaction = thisRow.colaction.replace(/wrbuttonspew/g, "wrbuttonspew disableSBSectionClass ");
                                    if (isWt)
                                    {
                                        if (undefined != thisRow.COUNT_ON_WAITLIST)
                                        {
                                            thisRow.COUNT_ON_WAITLIST = thisRow.COUNT_ON_WAITLIST.toString().replace(/\d+/g, function(n)
                                            {
                                                return Number(n) + 1;
                                            });
                                        }
                                    }

                                }
                                else
                                {
                                    if (!isAlreadyExist(thisRow.SECTION_NUMBER, undefined, undefined, 'ALL')[0])
                                    {
                                        thisRow.colaction = thisRow.colaction.replace(/disableSBSectionClass/g, "");
                                    }
                                }

                            }

                            if (!isWt)
                            {

                                if (!jobDone
                                    && undefined != thisRow.SECTION_NUMBER
                                    && thisRow.SECTION_NUMBER.toString().match(reSectionHead))
                                {

                                    if (undefined != thisRow.AVAIL_SEAT)
                                    {
                                        if (thisRow.AVAIL_SEAT.toString().match(/^\s*\d+\s*$/))
                                        {
                                            if (thisRow.AVAIL_SEAT > 0)
                                            {
                                                thisRow.AVAIL_SEAT = thisRow.AVAIL_SEAT - 1;
                                            }
                                            jobDone = true;
                                        }
                                    }
                                }
                            }
                        });
                    });
                    searchLoadGridPage(sLocalDataCurrentPage, false, false);
                }
            }

            if ('YES' == data.WARNING)
            {

                var reason = "";

                if (undefined != data.REASON
                    || "null" != data.REASON)
                {
                    reason = data.REASON;
                }
                if (isWt)
                {
                    tipMsg = "<div class='msg alert'><h4>Request Successful with warning</h4><span>Waitlisted "
                        + subjCrse.trim()
                        + " with "
                        + gradeOptionConv(gradeVal)
                        + " grade option for "
                        + unitVal
                        + " units, Section "
                        + sectionHead
                        + ".<br /><br />"
                        + reason
                        + "</span></div>";
                }
                else
                {

                    tipMsg = "<div class='msg alert'><h4>Request Successful with warning</h4><span>Enrolled in "
                        + subjCrse.trim()
                        + " with "
                        + gradeOptionConv(gradeVal)
                        + " grade option for "
                        + unitVal
                        + " units, Section "
                        + sectionHead
                        + ".<br /><br />"
                        + reason
                        + "</span></div>";

                    if (data.WAIT_DROP_MSG != undefined)
                    {
                        tipMsg += "<br /><div class='msg error'><h4>Alert:</h4><strong>"
                            + data.WAIT_DROP_MSG
                            + "</strong></div>";
                    }
                }
            }
            else
            {
                if (isWt)
                {

                    tipMsg = "<div class='msg confirm'><h4>Request Successful</h4><span>Waitlisted "
                        + subjCrse.trim()
                        + " with "
                        + gradeOptionConv(gradeVal)
                        + " grade option for "
                        + unitVal
                        + " units, Section "
                        + sectionHead
                        + ".</span></div>";

                }
                else
                {
                    tipMsg = "<div class='msg confirm'><h4>Request Successful</h4><span>Enrolled in "
                        + subjCrse.trim()
                        + " with "
                        + gradeOptionConv(gradeVal)
                        + " grade option for "
                        + unitVal
                        + " units, Section "
                        + sectionHead
                        + ".</span></div>";
                }
            }

            tipMsg = tipMsg
                + planErrMsg;

            // conflict message
            tipMsg += checkAllEditConflictsAndGetMsg(sectionHead, !fromEnrollmentGrid);
        }
        else
        {

            var reason = "";
            if (undefined != data.REASON
                || "null" != data.REASON)
            {
                reason = data.REASON;
            }
            tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Attempting to add "
                + subjCrse.trim()
                + ", Section "
                + sectionHead
                + ".  "
                + reason
                + "</span></div>";
        }

        var $tmpDiag = $("#dialog-after-action").dialog('open');
        $tmpDiag.dialog('option', 'buttons', dialogAfterActionBut);
        $tmpDiag.dialog('option', 'actionevent', tipMsg);
        updateTips(tipMsg);
    });

}

function classEnrollEditFun(
    action,
    sectionHead,
    subjCode,
    crseCode,
    stitle,
    gradeEnable,
    gradeDefault,
    unitEnable,
    unitDefault,
    unitFrom,
    unitTo,
    unitInc,
    buttonRowId,
    editWarn,
    waitlistDropMsg)
{

    $("#diagenroll-class-table-subj").empty();
    $("#diagenroll-class-table-title").empty();
    $("#diagenroll-class-table-grade-p").empty();
    $("#diagenroll-class-table-unit-p").empty();
    $("#diagenroll-class-table-code").empty();
    $("#diagenroll-class-table-type").empty();
    $("#diagenroll-class-table-days").empty();
    $("#diagenroll-class-table-time").empty();

    var aLevel = urlParam2;

    var crseCodeTmp = formatCrseCode(crseCode);
    var subjCrse = subjCode
        + " "
        + crseCode;
    var $diagObj = $('#dialog-enroll').dialog('open');

    $diagObj.dialog('option', 'action', action);
    $diagObj.dialog('option', 'sectionhead', sectionHead);
    $diagObj.dialog('option', 'subjcrse', subjCrse);
    $diagObj.dialog('option', 'subjcode', subjCode);
    $diagObj.dialog('option', 'crsecode', crseCode);
    $diagObj.dialog('option', 'buttonrowid', buttonRowId);

    $('#diagenroll-class-table-subj').text(subjCrse);
    $('#diagenroll-class-table-title').text(stitle);

    $('#dialog-enroll-button-confirm').button('enable');

    var thisObj = $("#list-id-table");
    var thisIds = thisObj.jqGrid('getDataIDs');
    var gridDataArr = [];

    for (var i = 0; i <= thisIds.length; i++)
    {
        var rowId = thisIds[i];
        rowData = thisObj.jqGrid('getRowData', rowId);
        if (undefined != rowData.PB_FRIEND
            && "true" == rowData.PB_FRIEND)
        {
            continue;
        }
        if (rowData.SECTION_HEAD == sectionHead)
        {
            gridDataArr.push({
                title : rowData.CRSE_TITLE,
                grade : rowData.GRADE_OPTION,
                unit : rowData.SECT_CREDIT_HRS,
                code : rowData.SECT_CODE,
                type : rowData.FK_CDI_INSTR_TYPE,
                days : rowData.DAY_CODE,
                time : rowData.coltime
            });
        }
    }

    var fromEnrollmentGrid = gridDataArr.length > 0;
    $diagObj.dialog('option', 'fromEnrollmentGrid', fromEnrollmentGrid);
    // handling extra info from enrollment grid

    $('.diagenroll-class-table-no1234').remove();

    if (fromEnrollmentGrid)
    {
        gridDataArr[0].title = gridDataArr[0].title.replace("<br />", "");
        gridDataArr[0].title = gridDataArr[0].title.replace("<br>", "");
        $('#diagenroll-class-table-title').text(gridDataArr[0].title);

        gradeDefault = gridDataArr[0].grade;
        unitDefault = gridDataArr[0].unit;

        $.each(gridDataArr, function(index, entry)
        {

            if (index == 0)
            {
                $('#diagenroll-class-table-code').text(entry.code);
                $('#diagenroll-class-table-type').text(gradeOptionConv(entry.type));
                $('#diagenroll-class-table-days').text(entry.days);
                $('#diagenroll-class-table-time').text(entry.time);
            }
            else
            {
                var table = $("#diagenroll-class-table");
                table.append("<tr class='diagenroll-class-table-no1234'>"
                    + "<td class='diagclass-class-table-empty'></td>"
                    + "<td class='diagclass-class-table-empty'></td>"
                    + "<td class='diagclass-class-table-empty'></td>"
                    + "<td class='diagclass-class-table-empty'></td>"
                    + "<td>"
                    + entry.code
                    + "</td>"
                    + "<td>"
                    + gradeOptionConv(entry.type)
                    + "</td>"
                    + "<td>"
                    + entry.days
                    + "</td>"
                    + "<td>"
                    + entry.time
                    + "</td>"
                    + "</tr>");
            }
        });

    }
    else
    { // else from search grid
        var count = 0;
        var rows = $(".wr-search-group-data-row").filter(function()
        {
            return $(this).children("td[aria-describedby='search-div-b-table_SECTION_NUMBER']").text().indexOf(sectionHead) != -1;
        });

        // add subtitle to course title if it exists
        var subtitle = "";
        if (isIE8)
        {
            subtitle = $('#'
                + rows[0].id).children("td[aria-describedby='search-div-b-table_SECTION_NUMBER']")[0].innerHTML.trim();
        }
        else
        {
            subtitle = $('#'
                + rows[0].id).children("td[aria-describedby='search-div-b-table_SECTION_NUMBER']")[0].textContent.trim();
        }
        // var subtitle =
        // $('#'+rows[0].id).children("td[aria-describedby='search-div-b-table_SECTION_NUMBER']")[0].textContent.trim();
        subtitle = subtitle.replace(/^\d+/, '');
        if (subtitle.trim() != "")
        {
            subtitle = stitle
                + " - "
                + subtitle.trim();
            $('#diagenroll-class-table-title').text(subtitle);
        }

        rows.sort(function(a, b)
        {
            return a.id > b.id;
        });
        var groupData = [];

        $.each(rows, function(index, entry)
        {

            var sectionCode = "";
            var instType = "";
            var dayCode = "";
            var time = "";
            if (isIE8)
            {
                sectionCode = $("#"
                    + entry.id).children("td[aria-describedby='search-div-b-table_SECT_CODE']")[0].innerHTML.trim();
                instType = $("#"
                    + entry.id).children("td[aria-describedby='search-div-b-table_FK_CDI_INSTR_TYPE']")[0].innerHTML.trim();
                dayCode = $("#"
                    + entry.id).children("td[aria-describedby='search-div-b-table_DAY_CODE']")[0].innerHTML.trim();
                time = $("#"
                    + entry.id).children("td[aria-describedby='search-div-b-table_coltime']")[0].innerHTML.trim();
            }
            else
            {
                sectionCode = $("#"
                    + entry.id).children("td[aria-describedby='search-div-b-table_SECT_CODE']")[0].textContent.trim();
                instType = $("#"
                    + entry.id).children("td[aria-describedby='search-div-b-table_FK_CDI_INSTR_TYPE']")[0].textContent.trim();
                dayCode = $("#"
                    + entry.id).children("td[aria-describedby='search-div-b-table_DAY_CODE']")[0].textContent.trim();
                time = $("#"
                    + entry.id).children("td[aria-describedby='search-div-b-table_coltime']")[0].textContent.trim();
            }

            // var sectionCode =
            // $("#"+entry.id).children("td[aria-describedby='search-div-b-table_SECT_CODE']")[0].textContent.trim();
            // var instType =
            // $("#"+entry.id).children("td[aria-describedby='search-div-b-table_FK_CDI_INSTR_TYPE']")[0].textContent.trim();
            // var dayCode =
            // $("#"+entry.id).children("td[aria-describedby='search-div-b-table_DAY_CODE']")[0].textContent.trim();
            // var time =
            // $("#"+entry.id).children("td[aria-describedby='search-div-b-table_coltime']")[0].textContent.trim();
            if (instType != "")
            {
                if (count == 0)
                {
                    $('#diagenroll-class-table-code').text(sectionCode);
                    $('#diagenroll-class-table-type').text(gradeOptionConv(instType));
                    $('#diagenroll-class-table-days').text(dayCode);
                    $('#diagenroll-class-table-time').text(time);
                }
                else
                {
                    var table = $("#diagenroll-class-table");
                    table.append("<tr class='diagenroll-class-table-no1234'>"
                        + "<td class='diagclass-class-table-empty'></td>"
                        + "<td class='diagclass-class-table-empty'></td>"
                        + "<td class='diagclass-class-table-empty'></td>"
                        + "<td class='diagclass-class-table-empty'></td>"
                        + "<td>"
                        + sectionCode
                        + "</td>"
                        + "<td>"
                        + gradeOptionConv(instType)
                        + "</td>"
                        + "<td>"
                        + dayCode
                        + "</td>"
                        + "<td>"
                        + time
                        + "</td>"
                        + "</tr>");
                }
                count++;
            }
        });

    }

    // grade --------------------------
    var gradeP = $('#diagenroll-class-table-grade-p');

    gradeP.empty();
    if (gradeEnable)
    {
        gradeP.append("<select class='diagxxx-class-table-td-select' id='diagenroll-class-table-grade'></select>");
        var gradeSelect = $('#diagenroll-class-table-grade');
        gradeSelect.empty();
        if (aLevel == 'UN')
        {
            gradeSelect.append($('<option></option>').val('L').html('Letter'));
            gradeSelect.append($('<option></option>').val('P').html('Pass / No Pass'));
        }
        else if (aLevel == 'GR')
        {
            gradeSelect.append($('<option></option>').val('L').html('Letter'));
            gradeSelect.append($('<option></option>').val('S').html('Satisfactory / Unsatisfactory'));
        }
        else if (aLevel == 'PH')
        {
            wrapperGetAcademicLevelForCourse(subjCode, crseCode, function(data)
            {
                if (data.ACADEMIC_LEVEL == 'GR')
                {
                    gradeSelect.append($('<option></option>').val('L').html('Letter'));
                }
                else
                {
                    gradeSelect.append($('<option></option>').val('H').html('Honors Pass / Fail'));
                }
                gradeSelect.append($('<option></option>').val('S').html('Satisfactory / Unsatisfactory'));
            });
        }

        if (undefined != gradeDefault)
        {
            gradeSelect.val(gradeOptionGridDeConv(gradeDefault));
        }

    }
    else
    {
        if (undefined != gradeDefault)
        {
            gradeP.text(gradeOptionConv(gradeDefault));
        }
        else
        {
            if (aLevel == 'UN')
            {
                gradeP.text('Pass / No Pass');
            }
            else if (aLevel == 'GR')
            {
                gradeP.text('Satisfactory / Unsatisfactory');
            }
            else if (aLevel == 'PH')
            {
                gradeP.text('Satisfactory / Unsatisfactory');
            }
        }
    }

    // units ----------------
    // unitDefault=6 ; unitTo=12 ; unitFrom=1 ; unitInc=1 ; unitEnable = true;
    var unitP = $('#diagenroll-class-table-unit-p');
    unitP.empty();
    if (unitEnable
        && undefined != unitFrom
        && undefined != unitTo
        && undefined != unitInc)
    {
        unitP.append("<select class='diagxxx-class-table-td-select' id='diagenroll-class-table-unit' ></select>");
        var unitSelect = $('#diagenroll-class-table-unit');
        unitSelect.empty();
        var retObj = getUnitSelectVal(unitFrom, unitTo, unitInc, unitDefault);
        $.each(retObj.ob2, function(key, val)
        {
            unitSelect.append($('<option></option>').val(key).html(val));
        });
        unitSelect.val(retObj.ob1);
    }
    else
    {
        unitP.text(unitDefault);
    }

    // classinfo for add enroll (from search)
    var tipMsg = "<b>Confirm class, and/or grading option or units to waitlist</b><br><br>";
    if (action == 'enroll')
    {
        tipMsg = "<b>Confirm class, and/or grading option or units to enroll</b><br><br />";
    }

    if (undefined != editWarn)
    {
        tipMsg = tipMsg
            + "<div class='msg alert'><h4>Alert: </h4>"
            + editWarn
            + "</div>";
    }
    if (waitlistDropMsg != undefined)
    {
        tipMsg = tipMsg
            + "<div class='msg error'><h4>Alert:</h4><strong>"
            + waitlistDropMsg
            + "</strong></div>";
    }

    // conflict message
    tipMsg += checkAllEditConflictsAndGetMsg(sectionHead, !fromEnrollmentGrid);

    updateTips(tipMsg);

}
;

function classEnrollFun(sectionHead, action, subjCode, crseCode, stitle, searchTitle, buttonRowId)
{

    var isWt = (action == 'enroll') ? false : true;

    if (undefined == stitle)
    {
        stitle = searchTitle.toString().split('(')[0];
    }

    wrapperEditEnroll(isWt, sectionHead, subjCode, crseCode, function(data)
    {

        var gradeEnable = false;
        var unitEnable = false;
        var unitFrom = undefined;
        var unitTo = undefined;
        var unitInc = undefined;
        var unitDefault = undefined;
        var gradeDefault = undefined;
        var tipMsg = "";

        if ('SUCCESS' == data.OPS)
        {

            var editWarn = undefined;
            if ('YES' == data.WARNING)
            {
                if (undefined != data.REASON
                    || "null" != data.REASON)
                {
                    editWarn = data.REASON;
                }
            }

            if ('YES' == data.GRADE)
            {
                gradeEnable = true;
            }
            if ('YES' == data.UNIT)
            {
                unitEnable = true;
                unitFrom = data.UNIT_FROM;
                unitTo = data.UNIT_TO;
                unitInc = data.UNIT_INC;
            }

            var waitlistDropMsg = data.WAIT_DROP;

            // could be undefined
            gradeDefault = data.GRADE_DEFAULT;
            unitDefault = data.UNIT_DEFAULT;

            classEnrollEditFun(
                action,
                sectionHead,
                subjCode,
                crseCode,
                stitle,
                gradeEnable,
                gradeDefault,
                unitEnable,
                unitDefault,
                unitFrom,
                unitTo,
                unitInc,
                buttonRowId,
                editWarn,
                waitlistDropMsg);

        }
        else
        {
            var reason = "Service error.";
            if (undefined != data.REASON
                || "null" == data.REASON)
            {
                reason = data.REASON;
            }
            if (isWt)
            {
                tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Attempting to waitlist class "
                    + subjCode.trim()
                    + " "
                    + crseCode.trim()
                    + ", Section "
                    + sectionHead
                    + ".  "
                    + reason
                    + "</span></div>";
            }
            else
            {
                tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Attempting to add "
                    + subjCode.trim()
                    + " "
                    + crseCode.trim()
                    + ", Section "
                    + sectionHead
                    + ".  "
                    + reason
                    + "</span></div>";
            }

            var $tmpDiag = $("#dialog-after-action").dialog('open');
            $tmpDiag.dialog('option', 'buttons', dialogAfterActionBut);
            $tmpDiag.dialog('option', 'actionevent', tipMsg);
            updateTips(tipMsg);
        }
    });
}

// search ----------------------------------------------------------

var searchFromTop = false;
var searchNextRowNum = (function()
{
    var counter = 1;
    return function()
    {
        return counter++;
    };
}());
var gSubjData = null;
wrapperSearchLoadSubject(function(data)
{
    gSubjData = data;
});
var subjDataSel = [];
subjDataSel.length = 0;
var subjCodeToDesc = {};

$.each(gSubjData, function(index, entry)
{

    var subjText = entry.SUBJECT_CODE
        + ' / '
        + entry.LONG_DESC;
    subjDataSel.push({
        id : index, text : subjText, subjcode : entry.SUBJECT_CODE, subjdesc : entry.LONG_DESC
    });

    var thisSubj = entry.SUBJECT_CODE.trim();
    subjCodeToDesc[thisSubj] = entry.LONG_DESC;
});

// department. Load on first demand
var gDepData = null;
var depDataSel = [];
depDataSel.length = 0;

// initialzied
var basicSearchSubjObj = undefined;
var selectBottomInitSubj = false;
var selectBottomInitDep = false;
var sGridObj = $("#search-div-b-table");
var sLocalDataAll = [];
var sLocalData = [];
var sLocalDataLoaded = [];
var sLocalDataPageNum = $("#search-pager-dropdown option:selected").val();
var sLocalDataCurrentPage = undefined;
var openGroupIds = [];
var openGroupIdsLoaded = [];
var subjList = [];
var subjCrseList = [];
var subjCrseTextList = [];

// constants
var searchSectionIdArr = [];
searchSectionIdArr.length = 0;
var searchProfStr = "";
var searchDaysStr = "";
var searchTimeStrStart = "";
var searchTimeStrEnd = "";
var searchTitleStr = "";

// search top >>>select2 -------------------------------------

// handlers search
$('#search-div-t-b1').click(function()
{
    initGridAll();
    searchOpenGrid();
    searchTopFun();
});

// persist

var subjDataSelTmp = [];
subjDataSelTmp.length = 0;
var subjDataSelCrseAll = [];
subjDataSelCrseAll.length = 0;
var subjDataSelCrseAllSort = undefined;
var lastReDataTop = undefined;

wrapperSearchGetCrseList(urlParam1, "", function(data)
{
    $.each(data, function(index, entry)
    {
        subjDataSelCrseAll.push({
            id : "crselist-"
                + entry.SUBJ_CODE
                + "-"
                + index, text : entry.SUBJ_CODE
                + " "
                + entry.CRSE_CODE, subjcode : entry.SUBJ_CODE, crsecode : entry.CRSE_CODE
        });
    });
});

$("#search-div-t-t1-i1").select2c({
    combobox : true, containerCss : {
        "display" : "block"
    }, // need this
    containerCssClass : "wr-select-top", dropdownCssClass : "wr-select-top-drop", placeholder : "(e.g., BILD, BILD 3 or computer 3 )",

    query : function(query)
    {

        var inputAll = query.term
        var subjDataSelCrseMat = undefined;

        if (undefined != inputAll
            && inputAll.trim().length < 2)
        {
            $("#search-div-t-t1-i1").select2c('close');
            lastReDataTop = [];
            return;
        }

        var reData = {
            results : []
        }
        var inputText = inputAll.replace(/\d.*/, '').trim(); // subj part
        var inputCrse = inputAll.replace(/^\D+(\d.*)/, '$1').trim(); // crse
        // part
        var crseOnly = (inputAll.trim() == inputCrse) ? true : false;

        if (!inputCrse.match(/^\d.*$/))
        {
            inputCrse = undefined;
        }

        if ('' == inputAll.trim())
        {
            $("#search-div-t-t1-i1").select2c('close');

            return;
        }

        if (undefined != inputCrse)
        {
            var reDataSubjCrseList = [];
            reDataSubjCrseList.length = 0;
            if (undefined == subjDataSelCrseAllSort)
            { // hashing on subj - lazy
                subjDataSelCrseAllSort = {};

                for (var i = 0; i < subjDataSelCrseAll.length; i++)
                {
                    var hashKey = subjDataSelCrseAll[i].subjcode.trim();
                    if (undefined == subjDataSelCrseAllSort[hashKey])
                    {
                        subjDataSelCrseAllSort[hashKey] = [];
                        subjDataSelCrseAllSort[hashKey].length = 0;
                    }
                    subjDataSelCrseAllSort[hashKey].push(subjDataSelCrseAll[i]);
                }

            }

            if (crseOnly)
            {
                subjDataSelCrseMat = subjDataSelCrseAllSort;
            }
            else
            {

                inputText = inputText.replace(/[{()} ]/g, '');
                var reSubjCode = new RegExp("^\\s*"
                    + inputText
                    + "\\s*$", 'i');
                var reText = new RegExp(inputText, 'i');

                var subjCodeList = [];
                subjCodeList.length = 0;

                $.each(subjDataSelTmp, function(i, entry)
                {
                    if (entry.subjcode.match(reSubjCode)
                        || entry.text.match(reText))
                    {
                        subjCodeList.push(entry.subjcode);
                    }
                });

                subjDataSelCrseMat = {};
                for (var i = 0; i < subjCodeList.length; i++)
                {
                    var thisSubj = subjCodeList[i].trim();
                    subjDataSelCrseMat[thisSubj] = subjDataSelCrseAllSort[thisSubj];
                }

            }

            var reTmp = new RegExp('^\\s*'
                + inputCrse, "i");
            if (crseOnly)
            {
                $.each(subjDataSelCrseAll, function(index, entry)
                {
                    if (entry.crsecode.match(reTmp))
                    {
                        reDataSubjCrseList.push(entry);
                    }
                });
            }
            else
            {

                var tmpList = [];
                tmpList.length = 0;

                var reTmpSubjCode = new RegExp("^\\s*"
                    + inputText, "i");
                var reTmpSubjText = new RegExp(inputText, "i");

                var reTmpCrse = new RegExp(inputCrse);

                $.each(subjDataSelCrseMat, function(key, entry)
                {
                    if (key.match(reTmpSubjCode))
                    {
                        for (var i = 0; i < entry.length; i++)
                        {
                            if (entry[i].crsecode.match(reTmp))
                            {
                                reDataSubjCrseList.push(entry[i]);
                            }
                        }
                    }

                    else if (subjCodeToDesc[key].match(reTmpSubjText))
                    {
                        for (var i = 0; i < entry.length; i++)
                        {
                            if (entry[i].crsecode.match(reTmp))
                            {
                                tmpList.push(entry[i]);
                            }
                        }
                    }
                });
                if (tmpList.length > 0)
                {
                    reDataSubjCrseList = reDataSubjCrseList.concat(tmpList);
                }
                tmpList = [];
                tmpList.length = 0; // release
            }

            if (0 < reDataSubjCrseList.length)
            {
                for (var i = 0; i < reDataSubjCrseList.length; i++)
                {
                    reData.results.push(reDataSubjCrseList[i]);
                }
            }

        }
        else
        {
            var tmpList = [];
            tmpList.length = 0;
            var reTerm1 = new RegExp("^\s*"
                + inputAll.trim(), 'i');
            var reTerm2 = new RegExp(inputAll.trim(), 'i');

            $.each(subjDataSelTmp, function(i, entry)
            {
                if (undefined != entry.text)
                {

                    if (entry.text.match(reTerm1))
                    {
                        reData.results.push({
                            id : "subjlist-text-"
                                + i, text : entry.text, subjcode : entry.subjcode
                        });
                    }
                    else if (entry.text.match(reTerm2))
                    {
                        tmpList.push({
                            id : "subjlist-text-"
                                + i, text : entry.text, subjcode : entry.subjcode
                        });
                    }
                }
            });
            if (tmpList.length > 0)
            {
                reData.results = reData.results.concat(tmpList);
            }
            tmpList = [];
            tmpList.length = 0; // release

        }

        lastReDataTop = $.extend(true, [], reData.results);
        query.callback(reData);
        return;

    }
});

$("#search-div-t-t1-i1").on('change', function(e)
{
    if (undefined == e.added)
    {
        return;
    }
    else if ("select-all" == e.added)
    {
        $('#search-div-t-b1').trigger('click');
    }
    else
    {
        lastReDataTop = [];
        lastReDataTop.length = 0;
        lastReDataTop.push(e.added);
        $("#search-div-t-t1-i1").select2c('close');
        $('#search-div-t-b1').trigger('click');
    }
});

// placeholder
$("#search-div-0 #s2id_autogen1").val("(e.g., BILD, BILD 3 or computer 3 )");
$("#search-div-0 #s2id_autogen1").click(function()
{
    $("#search-div-0 #s2id_autogen1").val("");
    $("#search-div-t-t1-i1").val("");
});

$("#search-div-t-t1-i1").on('select2-opening', function()
{
    subjDataSelTmp = [];
    subjDataSelTmp.length = 0;
    subjDataSelTmp = $.extend(true, [], subjDataSel);
});

// end of search top --------------------------------------------------------

$('#advanced-search').click(classSearchFun);

function searchGlobalInitialize()
{

    sLocalData.length = 0;
    sLocalDataAll.length = 0;
    sLocalDataLoaded = [];
    sLocalDataLoaded.length = 0;
    sLocalDataCurrentPage = undefined;

    openGroupIds.length = 0;
    openGroupIdsLoaded.length = 0;

    subjList.length = 0;
    subjCrseList.length = 0;
    subjCrseTextList.length = 0;
    sGridObj.jqGrid("clearGridData", true);

}

$("#search-div-t-t1-i1").val(""); // on load

function searchTopFun()
{
    searchSectionIdArr = [];
    searchSectionIdArr.length = 0;

    var inputCrse = "";

    if (undefined != lastReDataTop
        && lastReDataTop.length > 0)
    {
        var tmpList = [];
        tmpList.length = 0;

        var isCrse = false;
        if (lastReDataTop[0].id.match(/crse/))
        {
            isCrse = true;
        }

        if (isCrse)
        {
            $.each(lastReDataTop, function(index, entry)
            {
                var crsePart = entry.text.replace(/^\D+(\d.*)/, '$1').trim();
                tmpList.push(entry.subjcode.trim()
                    + ":"
                    + formatCrseCode(crsePart));
            });
        }
        else
        {
            $.each(lastReDataTop, function(index, entry)
            {
                tmpList.push(entry.subjcode.trim());
            });
        }

        if (0 < tmpList.length)
        {
            inputCrse = tmpList.join(";");
        }
    }
    searchBottomFun("", inputCrse, undefined, true, false);
}

function searchBySectionId(sectionId)
{
    var tmp1List = sectionId.toString().split(/[,;]+/);
    var tmp2List = [];
    for (var i = 0; i < tmp1List.length; i++)
    {
        if (tmp1List[i].match(/^\s*$/))
        {
            continue;
        }

        /* commented by Sowmya for fix CS0098999
        if (!tmp1List[i].toString().match(/^\s*\d{6}\s*$/))
        {
            $("#dialog-msg-small").dialog('open')
            updateTips("Invalid section id: "
                + tmp1List[i]);
            return;
        }*/
        if (tmp1List[i].toString().length < 6)
        {
            var str = tmp1List[i].toString();
            tmp1List[i] = str.padStart(6, '0');
        }
        tmp2List.push(tmp1List[i].trim());
        searchSectionIdArr.push(tmp1List[i].trim());
    }
    var tmp3ListStr = tmp2List.join(":");
    searchGlobalInitialize();
    $('#search-grid-result').show();
    $('#search-grid-toggle').text("Hide search result");
    wrapperSearchBySectionid(tmp3ListStr, searchHandleGroupFun);
    return;
}

function searchSortFunc(cell, row)
{
    var thisKey = cell.replace(/^.*::(.*)::.*$/, '$1');
    var thisVal = basicSearchSubjObj[thisKey];
    return String(thisVal);
}

var searchOpenSection = false;

var prevQuery;

function searchBottomFun(pSubjCode, pCrseCode, pSectCode, fromTop, preAuth)
{

    prevQuery = function()
    {
        searchBottomFun(pSubjCode, pCrseCode, pSectCode, fromTop, preAuth);
    }

    searchSectionIdArr = [];
    searchSectionIdArr.length = 0;

    // open section
    var subjCode = "";
    var crseCode = "";
    var levels = "";
    var days = "";
    var timeStr = "";
    var dep = "";
    var prof = "";
    var title = "";
    var sectionId = "";

    searchOpenSection = false;

    var sortCol = sGridObj.getGridParam("colModel")[0];

    if (fromTop)
    {
        searchFromTop = true;
        sortCol.sorttype = searchSortFunc;

        crseCode = pCrseCode;

        if (crseCode == "")
        {
            updateSearchTips2("No results found, please verify your input and try another search.");
            return;
        }

    }
    else
    {
        searchFromTop = false;
        sortCol.sorttype = "text"; // must restore

        sectionId = undefined;

        if (preAuth)
        {
            if (undefined != pSectCode)
            {
                searchBySectionId(pSectCode);
                return;
            }
            else
            {
                subjCode = pSubjCode;
                crseCode = pCrseCode;
            }

        }
        else
        {

            sectionId = $("#search-div-t-t3-i4").val().trim();

            if (undefined != sectionId
                && !sectionId.toString().match(/^\s*$/))
            {
                searchBySectionId(sectionId);
                return;
            }

            if (undefined == pSubjCode)
            {
                if ($("#search-div-t-t2-i1").select2("data").length > 0)
                {
                    var tmpList = [];
                    tmpList.length = 0;
                    $.each($("#search-div-t-t2-i1").select2("data"), function(index, entry)
                    {
                        tmpList.push(entry.subjcode);
                    })
                    subjCode = tmpList.join(":");
                }
            }
            else
            {
                subjCode = pSubjCode;
                $("#search-div-t-t2-i1").val(''); // don't select
            }

            if (undefined == pCrseCode)
            {

                var tmp1 = $("#search-div-t-t2-i2").val().trim().toUpperCase();
                var tmp1List = tmp1.split(/[,;]+/);
                var tmp2List = [];

                for (var i = 0; i < tmp1List.length; i++)
                {
                    if (tmp1List[i].match(/^\s*$/))
                    {
                        continue;
                    }
                    var tmpSub = tmp1List[i].replace(/\d.*/, '').trim();
                    var tmpCrse = tmp1List[i].match(/\d/) ? tmp1List[i].replace(/^\D+(\d.*)/, '$1').trim() : "";

                    if ("" != tmpSub
                        && "" != tmpCrse)
                    {
                        tmp2List.push(tmpSub
                            + ":"
                            + formatCrseCode(tmpCrse));

                    }
                    else if ("" != tmpSub)
                    {
                        tmp2List.push(tmpSub);

                    }
                    else if ("" != tmpCrse)
                    {
                        tmp2List.push(formatCrseCode(tmpCrse));
                    }
                }
                crseCode = tmp2List.join(";");

            }
            else
            {
                crseCode = formatCrseCode(pCrseCode);
            }

            // department
            dep = $("#search-div-t-t3-i1").val();
            if (null != dep)
            {
                dep = dep.trim().toUpperCase();
            }

            if ($("#search-div-t-t3-i1").select2("data").length > 0)
            {
                var tmpList = [];
                tmpList.length = 0;
                $.each($("#search-div-t-t3-i1").select2("data"), function(index, entry)
                {
                    tmpList.push(entry.depcode);
                })
                dep = tmpList.join(":");
            }

            // prof and title must be upper
            prof = $("#search-div-t-t3-i2").val().trim().toUpperCase();
            title = $("#search-div-t-t3-i3").val().trim().toUpperCase();

            // show only - bool to 0,1
            levels = "";
            levels += $('#search-div-t-t4-c01').is(':checked') | 0;
            levels += $('#search-div-t-t4-c02').is(':checked') | 0;
            levels += $('#search-div-t-t4-c03').is(':checked') | 0;
            levels += $('#search-div-t-t4-c04').is(':checked') | 0;
            levels += $('#search-div-t-t4-c05').is(':checked') | 0;
            levels += $('#search-div-t-t4-c06').is(':checked') | 0;
            levels += $('#search-div-t-t4-c07').is(':checked') | 0;
            levels += $('#search-div-t-t4-c08').is(':checked') | 0;
            levels += $('#search-div-t-t4-c09').is(':checked') | 0;
            levels += $('#search-div-t-t4-c10').is(':checked') | 0;
            levels += $('#search-div-t-t4-c11').is(':checked') | 0;
            levels += $('#search-div-t-t4-c12').is(':checked') | 0;
            if (levels.match(/^0+$/))
            {
                levels = "";
            } // important for server perf

            // Days - bool to 0,1
            days = "";
            days += $('#search-div-t-t4-c13').is(':checked') | 0; // Mon
            days += $('#search-div-t-t4-c14').is(':checked') | 0;
            days += $('#search-div-t-t4-c15').is(':checked') | 0;
            days += $('#search-div-t-t4-c16').is(':checked') | 0;
            days += $('#search-div-t-t4-c17').is(':checked') | 0;
            days += $('#search-div-t-t4-c18').is(':checked') | 0;
            days += $('#search-div-t-t4-c19').is(':checked') | 0; // sun
            if (days.match(/^0+$/))
            {
                days = "";
            }

            // start and end time
            timeStr = "";
            var startTimeVal = $('#search-div-t-t5 tbody tr td:nth-child(2) select.ui-timepicker-select').val();
            var endTimeVal = $('#search-div-t-t5 tbody tr td:nth-child(4) select.ui-timepicker-select').val();

            // open section
            searchOpenSection = $('#search-div-t-t6-c01').is(':checked') ? true : false;

            if ("none" == startTimeVal)
            {
                startTimeVal = "";
            }
            if ("none" == endTimeVal)
            {
                endTimeVal = "";
            }
            var startTime = timeConv12To24(startTimeVal);
            var endTime = timeConv12To24(endTimeVal);
            if (!startTime.match(/^\d{4}$/))
            {
                startTime = "";
            }
            if (!endTime.match(/^\d{4}$/))
            {
                endTIme = "";
            }
            if (!("" == startTime && "" == endTime))
            {
                timeStr = startTime
                    + ":"
                    + endTime;
            }
            if ("" != startTime
                && "" != endTime
                && startTime >= endTime)
            {
                updateSearchTips2("Start time must be before end time");
                return;
            }
        } // ! preAuth
    }

    if ("" == levels
        && "" == days
        && "" == timeStr
        && "" == subjCode
        && "" == crseCode
        && "" == dep
        && "" == prof
        && "" == title
        && !searchOpenSection
        && !fromTop)
    {
        updateSearchTips2("No results found, please verify your input and try another search.");
        return;
    }

    if ("" == subjCode
        && "" == crseCode
        && "" == days
        && "" == timeStr
        && searchOpenSection
        && !fromTop)
    {
        $('#search-warning-msg').show();
    }

    searchGlobalInitialize();
    searchProfStr = prof;
    searchDaysStr = days;
    searchTimeStrStart = startTime;
    searchTimeStrEnd = endTime;
    searchTitleStr = title;

    if (searchOpenSection
        && !fromTop)
    {
        wrapperSearchByAll(subjCode, crseCode, dep, prof, title, levels, days, timeStr, false, false, "", function(data)
        {

            wrapperSearchByAll(subjCode, crseCode, dep, prof, title, levels, days, timeStr, true, false, "", function(dataOS)
            {
                for (var i = 0; i < data.length; i++)
                {
                    var found = false;
                    for (var j = 0; j < dataOS.length; j++)
                    {

                        if (data[i].SUBJ_CODE == dataOS[j].SUBJ_CODE
                            && data[i].CRSE_CODE == dataOS[j].CRSE_CODE)
                        {
                            found = true;
                            break;
                        }
                    }
                    if (!found)
                    {
                        data[i].NO_SEAT = true;
                    }
                }
                // remove courses with no seats
                for (var i = data.length - 1; i >= 0; i--)
                {
                    if (data[i].NO_SEAT)
                    {
                        data.splice(i, 1);
                    }
                }

                searchHandleGroupFun(data);
            });

        });

    }
    else
    {
        if (fromTop)
        {
            var basicSearchValue = $('#s2id_autogen1').val();
            wrapperSearchByAll(subjCode, crseCode, dep, prof, title, levels, days, timeStr, false, true, basicSearchValue, function(data)
            {
                var tmpList = crseCode.split(';');
                var data2 = {};
                var data3 = [];
                data3.length = 0;

                for (var i = 0; i < data.length; i++)
                {
                    var hashKey = data[i].SUBJ_CODE.trim();
                    if (undefined == data2[hashKey])
                    {
                        data2[hashKey] = [];
                        data2[hashKey].length = 0;
                    }
                    data2[hashKey].push(data[i]);
                }
                var curStrNum = 900001;
                basicSearchSubjObj = {};

                for (var i = 0; i < tmpList.length; i++)
                {

                    var tmpSubjCrse = tmpList[i].split(':');
                    var thisSubj = tmpSubjCrse[0].trim();
                    var thisCrse = undefined;

                    if (undefined != tmpSubjCrse[1])
                    {
                        thisCrse = tmpSubjCrse[1].trim();
                    }

                    for (j = 0; j < data2[thisSubj].length; j++)
                    {

                        var tmpCrse = data2[thisSubj][j].CRSE_CODE;
                        if (undefined == thisCrse)
                        {
                            var thisKey = thisSubj
                                + tmpCrse.trim();
                            if (!(thisKey in basicSearchSubjObj))
                            {
                                basicSearchSubjObj[thisKey] = ++curStrNum;
                            }
                            data3.push(data2[thisSubj][j]);
                            continue;
                        }

                        var reTmp = new RegExp("^\\s*"
                            + thisCrse
                            + "\\s*$", "i");

                        if (tmpCrse.match(reTmp))
                        {
                            var thisKey = thisSubj
                                + thisCrse;
                            if (!(thisKey in basicSearchSubjObj))
                            {
                                basicSearchSubjObj[thisKey] = ++curStrNum;
                            }
                            data3.push(data2[thisSubj][j]);
                        }
                    }
                }
                searchHandleGroupFun(data3);
            });

        }
        else
        {
            basicSearchSubjObj = undefined;
            wrapperSearchByAll(subjCode, crseCode, dep, prof, title, levels, days, timeStr, false, false, "", searchHandleGroupFun);
        }
    }
}

function searchHandleGroupFun(data)
{

    $('#search-warning-msg').hide();
    if (0 == data.length)
    {
        updateSearchTips2("No results found, please verify your input and try another search.");
        return;
    }
    searchGlobalInitialize();

    $.each(data, function(index, orgObj)
    {

        var subj = orgObj.SUBJ_CODE.trim();
        var crse = orgObj.CRSE_CODE.trim();
        var unitFrom = orgObj.UNIT_FROM;
        var unitTo = orgObj.UNIT_TO;
        var unitInc = orgObj.UNIT_INC;

        if (-1 == $.inArray(subj, subjList))
        {
            subjList.push(subj);
        }

        var unitStr = "";

        if (unitFrom == unitTo)
        {
            // unitStr = Math.floor(unitFrom);
            unitStr = unitFrom;
        }
        else
        {
            // unitStr = Math.floor(unitFrom) + "-" + Math.floor(unitTo);
            unitStr = unitFrom
                + "-"
                + unitTo;
        }

        if (1 == unitStr)
        {
            unitStr = ' ('
                + unitStr
                + ' unit)';
        }
        else
        {
            unitStr = ' ('
                + unitStr
                + ' units)';
        }

        var subjCrse = orgObj.SUBJ_CODE
            + ' '
            + orgObj.CRSE_CODE;

        if (true == orgObj.NO_SEAT)
        {
            orgObj.colsubj = '<!-- '
                + subjCrse
                + ' ::'
                + subj
                + crse
                + '::--><table style="float:left" id="search-group-header-id"><tbody>'
                + ' <tr><td style="width:86px; text-indent:15px; text-align:left;"> '
                + subjCrse
                + '</td>'
                + ' <td style="width:750px; text-align:left; "> '
                + orgObj.CRSE_TITLE.trim()
                + unitStr
                + '</td>'
                + ' <td class="search-group-header-noseat">No Seats Available'
                + ' </tr></tbody></table>'

        }
        else
        {
            orgObj.colsubj = '<!-- '
                + subjCrse
                + ' ::'
                + subj
                + crse
                + '::--><table style="float:left" id="search-group-header-id"><tbody>'
                + ' <tr><td style="width:70px; text-align:left;"> '
                + subjCrse
                + '</td>'
                + ' <td style="width:800px; text-align:left; "> '
                + orgObj.CRSE_TITLE.trim()
                + unitStr
                + '</td>'
                + ' <td></td>'
                + ' </tr></tbody></table>'
        }

        // mark header
        orgObj.ROW_MARKER = 0; // header

        sLocalDataAll.push(orgObj);

    });

    searchOpenPager();

    if (0 == data.length)
    {
        updateSearchTips2("No results found, please verify your input and try another search.");
    }
    else if (1 == data.length)
    {
        updateSearchTips(data.length
            + " course found");
    }
    else
    {
        updateSearchTips(data.length
            + " courses found");
    }

    // load all crseText
    var subjListStr = subjList.join(":");
    wrapperSearchGetCrseText(subjListStr, function(data)
    {
        subjCrseTextList = data;
    });

    searchLoadGridPage(0, true, false);
}

$("#search-pager-dropdown").change(function()
{
    var howMany = $("#search-pager-dropdown option:selected").val();
    sLocalDataPageNum = howMany;
    searchOpenPager();
    sLocalDataLoaded = [];
    sLocalDataLoaded.length = 0;
    openGroupIdsLoaded = [];
    openGroupIdsLoaded.length = 0;
    searchLoadGridPage(0, false, false);
});

function searchOpenPager()
{ // pager
    var sLocalDataAllPages = Math.ceil(sLocalDataAll.length
        / sLocalDataPageNum);
    var pageDisplay = sLocalDataAllPages;
    if (sLocalDataAllPages > 10)
    {
        pageDisplay = 10;
    }
    $("#search-pager-dropdown").show();
    $("#search-pager-dropdown-header").show();
    $("#search-pager").empty();

    var moreWidth = Number(pageDisplay) * 24;
    $("#search-pager").width(100 + Number(moreWidth));

    $("#search-pager").paginate({
        count : sLocalDataAllPages, start : 1, display : pageDisplay, border : true, border_color : '#fff', text_color : '#fff', background_color : '#0b4a67',

        border_hover_color : '#ccc', text_hover_color : '#000', background_hover_color : '#fff', images : false, mouse : 'slide', onChange : function(page)
        {
            searchLoadGridPage(page - 1, true, false); // start from 0
        }
    });
}

function searchLoadGridPage(pageId, saveCurrent, searchGridClose)
{ // pageId starting from 0

    var startIndex = pageId
        * sLocalDataPageNum;
    var endIndex = Number(startIndex)
        + Number(sLocalDataPageNum);

    if (typeof sLocalDataLoaded[pageId] == 'undefined')
    {
        var tmpArr = [];
        tmpArr.length = 0;
        tmpArr = $.extend(true, [], sLocalDataAll);
        sLocalDataLoaded[pageId] = tmpArr.slice(startIndex, endIndex);
    }

    if (undefined != sLocalDataCurrentPage)
    {
        if (saveCurrent)
        { // save on page move
            sLocalDataLoaded[sLocalDataCurrentPage] = $.extend(true, [], sLocalData);
        }
    }

    sLocalDataCurrentPage = pageId;
    sLocalData = $.extend(true, [], sLocalDataLoaded[pageId]);

    if (typeof openGroupIdsLoaded[pageId] == 'undefined')
    {
        openGroupIdsLoaded[pageId] = []; // push an empty array
    }
    openGroupIds = openGroupIdsLoaded[pageId];

    searchOpenGrid();
    searchReloadGrid(searchGridClose, sGridObj, sLocalData);
    searchInstallHandler(sLocalData);
    searchDisableBut();
    sGridObj.unbind('click').click(searchGroupClickFun);
}

function searchGroupClickFun(e)
{

    var groupingView = sGridObj.jqGrid("getGridParam", "groupingView");
    var plusIcon = groupingView.plusicon;
    var minusIcon = groupingView.minusicon;
    var target = $(e.target);

    var groupHeader = target.closest("tr.jqgroup"); // find header dom element

    var groupId = null;
    var subjCode = null;
    var crseCode = null;
    var stitle = null;

    if (groupHeader.length > 0)
    {

        groupId = groupHeader.attr("id"); // search-div-b-tableghead_0_7

        var gotSeat = $('#'
            + groupId
            + ' td.search-group-header-noseat').text();
        if (undefined != gotSeat
            && gotSeat.match(/no\s+seat/i))
        {
            return;
        }

        if (e.target.nodeName.toLowerCase() !== "span"
            || (!target.hasClass(plusIcon) && !target.hasClass(minusIcon)))
        {
            $(this).jqGrid("groupingToggle", groupId);
        }

        var headerText = $('#'
            + groupId
            + ' #search-group-header-id tr td:first-child').text().trim();
        subjCode = headerText.split(/\s+/)[0].trim();
        crseCode = headerText.split(/\s+/)[1].trim();
        stitle = $('#'
            + groupId
            + ' #search-group-header-id tr td:nth-child(2)').text().trim();
    }

    if (null == groupId)
    { // Non-group row
        return;
    }

    // closing
    if ($('#'
        + groupId
        + ' td:first-child span').hasClass('ui-icon-circlesmall-plus'))
    {
        var tmp = $.inArray(groupId, openGroupIds);
        if (-1 !== tmp)
        {
            openGroupIds.splice(tmp, 1);
        }
        return;
    }

    if (null != subjCode
        && null != crseCode
        && null != stitle)
    {
        searchGroupLoadFun(groupId, subjCode, crseCode, stitle);
    }

    // prevent default and bubble
    return false;
}
;

function searchGroupLoadFun(groupId, subjCode, crseCode, stitle)
{

    crseCodeWellForm = formatCrseCode(crseCode);
    var grIndex = null;
    $.each(sLocalData, function(index, entry)
    {
        if (0 == entry.ROW_MARKER)
        { // header
            var entryCrseCode = entry.CRSE_CODE.trim();
            var entrySubjCode = entry.SUBJ_CODE.trim();
            if (crseCode == entryCrseCode
                && subjCode == entrySubjCode)
            {
                grIndex = index;
                return false;
            }
        }
    });

    // loaded check
    if (null == grIndex)
    {
        $(".search-pbf-class").hide();
        openGroupIds.push(groupId);
        return;
    }

    // assume data is not loaded.
    var thisGroup = sLocalData[grIndex];

    // button action - subj/crse level check
    var groupButtonAction = "";
    if (isAlreadyExist(undefined, subjCode, crseCode, 'EN')[0])
    {
        groupButtonAction = "enExist";
    }
    else if (isAlreadyExist(undefined, subjCode, crseCode, 'WT')[0])
    { // enrolled or waitlisted
        groupButtonAction = "wtExist";
    }

    wrapperSearchLoadGroupData(
        subjCode.trim(),
        crseCode,
        crseCodeWellForm,
        function(data)
        {

            if (data.length <= 0)
            {
                sGridObj.jqGrid("groupingToggle", groupId);
                return;
            }

            var gone = sLocalData.splice(grIndex, 1);

            var sectNumList = [];
            sectNumList.length = 0;
            var cateObj = {};
            cateObj['cate0X'] = [];
            cateObj['cate0X'].length = 0;
            cateObj['ASortKey'] = 1000;
            cateObj['0SortKey'] = 99000;
            cateObj['0SortKey'] = 99000;

            var sectChArr = [];
            sectChArr.length = 0;
            var pushData1 = [];
            pushData1.length = 0;
            var pushData2 = [];
            pushData2.length = 0;

            var HasProf = ('' != searchProfStr) ? true : false;
            var HasDays = ('' != searchDaysStr) ? true : false;
            var HasTime = ('' != searchTimeStrStart || '' != searchTimeStrEnd) ? true : false;
            var HasTitle = ('' != searchTitleStr.trim());

            var daysStrFilter = "X"; // nothing matches
            if (HasDays)
            {
                if (0 == searchDaysStr.charAt(0))
                {
                    daysStrFilter = daysStrFilter
                        + "|1";
                } // MON
                if (0 == searchDaysStr.charAt(1))
                {
                    daysStrFilter = daysStrFilter
                        + "|2";
                } // TUE
                if (0 == searchDaysStr.charAt(2))
                {
                    daysStrFilter = daysStrFilter
                        + "|3";
                }
                if (0 == searchDaysStr.charAt(3))
                {
                    daysStrFilter = daysStrFilter
                        + "|4";
                }
                if (0 == searchDaysStr.charAt(4))
                {
                    daysStrFilter = daysStrFilter
                        + "|5";
                }
                if (0 == searchDaysStr.charAt(5))
                {
                    daysStrFilter = daysStrFilter
                        + "|6";
                }
                if (0 == searchDaysStr.charAt(6))
                {
                    daysStrFilter = daysStrFilter
                        + "|7";
                } // SUN
            }

            // loop1
            var prevObj = undefined;
            var accuDays = "";
            var accuTime = "";
            var accuBld = "";
            var accuRoom = "";
            var searchSectionIdObj = {};

            $.each(data, function(index, entry)
            {
                /*******************************************************************************************************
                 * This loop must not return anywhere except returnAllowed location Otherwise the last entry will not be
                 * flushed
                 ******************************************************************************************************/

                var sectChTmp = entry.SECT_CODE.substr(0, 1);
                if (sectChTmp.match(/^[A-Z]/))
                {
                    if (-1 == $.inArray(sectChTmp, sectChArr))
                    {
                        sectChArr.push(sectChTmp);
                    }
                }

                // section save
                entry.ORG_SECTION_NUMBER = entry.SECTION_NUMBER;

                // day
                entry.DAY_CODE_NUM = entry.DAY_CODE;
                var dayStr = dayConvNum2Str(entry.DAY_CODE);
                if (dayStr == "")
                {
                    dayStr = "TBA";
                }
                entry.DAY_CODE = dayStr

                // time
                var beginHH = entry.BEGIN_HH_TIME;
                var beginMM = entry.BEGIN_MM_TIME;
                var endHH = entry.END_HH_TIME;
                var endMM = entry.END_MM_TIME;
                var beginHM = beginHH
                    + ":"
                    + beginMM;
                var endHM = endHH
                    + ":"
                    + endMM;

                beginHM = timeConv24To12(beginHM);
                endHM = timeConv24To12(endHM);
                var timeStr = "";
                if (beginHH == 0
                    && beginMM == 0
                    && endHH == 0
                    && endMM == 0)
                {
                    timeStr = "TBA";
                }
                else
                {
                    timeStr = beginHM
                        + "-"
                        + endHM;
                }
                entry.coltime = timeStr;

                // button action - section level check
                var tmpArr = isAlreadyExist(entry.SECTION_NUMBER, undefined, undefined, 'ALL');
                if (tmpArr[0])
                {
                    switch (tmpArr[1])
                    {
                        case "PL":
                            entry.BUTTON_ACTION = "DISABLE-SECTION-PL";
                            ;
                            break;
                        case "EN":
                            entry.BUTTON_ACTION = "DISABLE-SECTION-ENWT";
                            ;
                            break;
                        case "WT":
                            entry.BUTTON_ACTION = "DISABLE-SECTION-ENWT";
                            ;
                            break;
                        default:
                            entry.BUTTON_ACTION = "";
                    }
                }
                else
                {
                    entry.BUTTON_ACTION = "";
                }

                // building
                var buildingCode = entry.BLDG_CODE;
                if (buildingCode != "TBA" && buildingCode !="RCLAS" && buildingCode !="     ")
                {
                    entry.BLDG_CODE = '<a target="_blank" class="nonewwin" href="https://maps.ucsd.edu/?id=1005#!s/'
                    	+ entry.BLDG_CODE.trim()+"_Main?ct/18312"
                        + '">'
                        + entry.BLDG_CODE.trim()
                        + '</a>';
                    /*entry.ROOM_CODE = '<a target="_blank" class="nonewwin" href=https://map.concept3d.com/?id=1005#!s/'
                    	+ entry.BLDG_CODE.trim()+"_Main?ct/18312"
                        + '">'
                        + entry.ROOM_CODE.trim()
                        + '</a>';*/
                    entry.ROOM_CODE = entry.ROOM_CODE.trim();
                }

                // filter - find section search ch
                if (searchSectionIdArr.length > 0)
                {
                    $.each(searchSectionIdArr, function(i, tmpsid)
                    {
                        if (entry.SECTION_NUMBER == tmpsid)
                        {
                            searchSectionIdObj[entry.SECT_CODE.substr(0, 1)] = true;
                        }
                    });
                }

                // merge
                if (1 == data.length)
                {
                    pushData1.push(entry);
                    return false; // returnAllowed
                }

                if (prevObj != undefined)
                {
                    if (prevObj.SECT_CODE == entry.SECT_CODE
                        && prevObj.FK_SPM_SPCL_MTG_CD == entry.FK_SPM_SPCL_MTG_CD
                        && !entry.FK_SPM_SPCL_MTG_CD.match(/MI|FI|FM|PB|RE|OT|MU/))
                    {

                        // save
                        entry.DAY_CODE = accuDays
                            + "\n"
                            + entry.DAY_CODE;
                        entry.coltime = accuTime
                            + "\n"
                            + entry.coltime;
                        entry.BLDG_CODE = accuBld
                            + "\n"
                            + entry.BLDG_CODE;
                        entry.ROOM_CODE = accuRoom
                            + "\n"
                            + entry.ROOM_CODE;

                    }
                    else
                    { // found new group -> flush upto prev
                        pushData1.push(prevObj);
                    }
                }

                if ((index + 1) == data.length)
                { // last ==> flush up to current
                    pushData1.push(entry);
                }

                accuDays = entry.DAY_CODE;
                accuTime = entry.coltime;
                accuBld = entry.BLDG_CODE;
                accuRoom = entry.ROOM_CODE;
                prevObj = $.extend(true, {}, entry);

            });

            // loop2
            var filterLeftNum = 0;
            var filterLeftNum00 = 0;
            var filterLeftNum0N = 0;
            var filterLeftNum0X = 0;

            var groupStartDate = undefined;
            var groupEndDate = undefined;

            var filteredSections = [];
            var unfilteredNCs = [];

            $.each(pushData1, function(index, entry)
            {

                // filter general
                if (undefined != entry.PRINT_FLAG
                    && entry.PRINT_FLAG.match(/N/i))
                {
                    return;
                }

                if (isSummerSession)
                {
                    // start and end date string
                    if (undefined == groupStartDate
                        || undefined == groupEndDate)
                    {
                        if (undefined != entry.SECTION_START_DATE)
                        {
                            groupStartDate = entry.SECTION_START_DATE;
                        }
                        if (undefined != entry.SECTION_END_DATE)
                        {
                            groupEndDate = entry.SECTION_END_DATE;
                        }
                    }
                }

                var sectCode = entry.SECT_CODE.trim();
                var sectCodeCh = sectCode.substr(0, 1);

                var sectCodeZero = sectCode.match(/00$|^0|^1/) ? true : false;
                // var sectCodeZero = sectCode.match(/00$/) ? true : false ;

                var acStatus = entry.FK_SST_SCTN_STATCD == 'AC';
                var caStatus = entry.FK_SST_SCTN_STATCD == 'CA';

                // skip empty row for whatever reason
                if (undefined == sectCode)
                {
                    return;
                }

                // filter open section
                if (searchOpenSection
                    && (acStatus || caStatus))
                {
                    if (undefined == entry.AVAIL_SEAT
                        || entry.AVAIL_SEAT < 1
                        || (undefined != entry.STP_ENRLT_FLAG && entry.STP_ENRLT_FLAG.match(/y/i)))
                    {
                        return;
                    }
                    else
                    {
                        unfilteredNCs.push(sectCodeCh
                            + "00");
                    }
                }
                else if (searchOpenSection
                    && sectCodeZero)
                {
                    if (unfilteredNCs.indexOf(sectCode) == -1)
                    {
                        // all AC non 00's were cancelled or full so don't show
                        // the 00 sections
                        return;
                    }
                }

                // filter - section search - save only 00, FI, MI
                if (searchSectionIdArr.length > 0
                    && (-1 === $.inArray(entry.SECTION_NUMBER.toString(), searchSectionIdArr)))
                {
                    if (!searchSectionIdObj[sectCodeCh])
                    {
                        return;
                    }
                    else
                    { // save 00 and NC
                        if (!sectCodeZero
                            && 'NC' != entry.FK_SST_SCTN_STATCD)
                        {
                            return;
                        }
                    }
                }

                // filter prof
                if (HasProf)
                {
                    var inst = (entry.PERSON_FULL_NAME.split(";"))[0].toUpperCase();

                    if (-1 == inst.indexOf(searchProfStr))
                    {
                        return;
                    }
                }

                // filter day - C
                if (HasDays
                    && (sectCodeZero))
                {
                    if (entry.DAY_CODE_NUM.match(daysStrFilter)
                        && !entry.FK_SPM_SPCL_MTG_CD.match(/MI|FI|FM|PB|RE|OT|MU/))
                    {
                        filteredSections.push(entry.ORG_SECTION_NUMBER);
                        return;
                    }
                    else
                    {
                        if (filteredSections.indexOf(entry.ORG_SECTION_NUMBER) != -1)
                        {
                            return;
                        }
                    }

                }

                // filter - time - BENG 168 7am-10am
                if (HasTime
                    && sectCodeZero)
                {

                    if (!entry.FK_SPM_SPCL_MTG_CD.match(/MI|FI|FM|PB|RE|OT|MU/))
                    {
                        var beginHM = entry.BEGIN_HH_TIME
                            + String("0"
                                + entry.BEGIN_MM_TIME).slice(-2);
                        var endHM = entry.END_HH_TIME
                            + String("0"
                                + entry.END_MM_TIME).slice(-2);
                        // 000 == TBA or CANCELLED
                        if ('000' != beginHM
                            && '' != searchTimeStrStart
                            && Number(beginHM) < Number(searchTimeStrStart))
                        {
                            filteredSections.push(entry.ORG_SECTION_NUMBER);
                            return;
                        }
                        if ('000' != endHM
                            && '' != searchTimeStrEnd
                            && Number(searchTimeStrEnd) < Number(endHM))
                        {
                            filteredSections.push(entry.ORG_SECTION_NUMBER);
                            return;
                        }

                    }
                    else
                    {
                        if (filteredSections.indexOf(entry.ORG_SECTION_NUMBER) != -1)
                        {
                            return;
                        }
                    }

                }

                // filter by title (course title or long desc)
                if (HasTitle)
                {
                    // remove the (# units)
                    var titlePieces = stitle.split("(");
                    var cleanTitle = stitle.replace("("
                        + titlePieces[titlePieces.length - 1], "");
                    cleanTitle = cleanTitle.trim();
                    // check title and desc
                    if (cleanTitle.toUpperCase().indexOf(searchTitleStr.trim()) == -1)
                    {
                        if (entry.LONG_DESC.toUpperCase().indexOf(searchTitleStr.trim()) == -1)
                        {
                            return;
                        }
                    }
                }

                // ------------- filter end ----------------------------//

                filterLeftNum++;

                entry.ROW_MARKER = 1; // loaded non-header
                entry.colsubj = thisGroup.colsubj;
                entry.SUBJ_CODE = subjCode;
                entry.CRSE_CODE = crseCode;
                entry.SEARCH_TITLE = stitle;

                sectNumList.push(entry.SECTION_NUMBER);

                // defaults
                entry.ROW_SPAN = 1;
                entry.ROW_COUP = 0;
                entry.ROW_SPAN_INST = 1;
                entry.COL_SPAN = 1;
                entry.COL_SPAN_SC = 1;
                entry.COL_SPAN_DAYS = 1;
                entry.ROW_ATTR = {
                    'rowClass' : 'wr-search-group-data-row '
                };
                entry.colaction = '';

                // book - only for graded section (== AC section)
                if ('AC' == entry.FK_SST_SCTN_STATCD
                    && !entry.FK_SPM_SPCL_MTG_CD.match(/MI|FI|FM|PB|RE|OT|MU/))
                {
                    entry.BOOK_LINK = '<a  target="_blank" href="https://www.bkstr.com/ucsdtextstore/shop/textbooks-and-course-materials' 
                       //wrtx/TextSearch?section=
                       // + entry.SECTION_NUMBER
                       // + '&term='
                       // + urlParam1
                       // + '&subject='
                       // + subjCode
                       // + '&course='
                       // + crseCode
                        + '"><img style="vertical-align:middle;"src="/webreg2/resources/images/book.gif" border="0" '
                        + 'alt="View book list" title="View book list"></a>';
                }
                else
                {
                    entry.BOOK_LINK = '';
                }

                // instructor search
                var inst = entry.PERSON_FULL_NAME.trim();
                if (inst == "")
                {
                    inst = "Staff";
                }
                else
                {
                    $.each(inst.split(':'), function(index, einst)
                    {
                        var einstArr = einst.split(';');
                        einstName = einstArr[0];
                        einstId = einstArr[1];

                        einstName = einstName.trim();

                        if (!einstName.match(/^\s*staff\s*$/i))
                        {
                            einstName = einstName
                                + ' <a class="email-link-class" emailref="'
                                + einstId
                                + '" emailname="'
                                + einstName
                                + '" href="#none"><img  style="vertical-align:middle;" src="/webreg2/resources/images/email_12.png" border="0" '
                                + 'alt="Send email to '
                                + einstName
                                + '" title="Send email to '
                                + einstName
                                + '"></img></a>';
                        }

                        if (index == 0)
                        {
                            inst = einstName;
                        }
                        else
                        {
                            inst = inst
                                + "\n"
                                + einstName;
                        }
                    });
                }
                entry.PERSON_FULL_NAME = inst;

                // seat
                if (entry.AVAIL_SEAT < 0)
                {
                    entry.AVAIL_SEAT = 0;
                }

                if (entry.FK_SST_SCTN_STATCD == 'AC')
                {
                    if (undefined == cateObj['cateNumAC'
                        + sectCodeCh])
                    {
                        cateObj['cateNumAC'
                            + sectCodeCh] = 0;
                    }
                    cateObj['cateNumAC'
                        + sectCodeCh]++;
                }

                // PBF
                if (undefined != entry.FK_SPM_SPCL_MTG_CD
                    && entry.FK_SPM_SPCL_MTG_CD.match(/FM|PB|RE|OT|MU/))
                {
                    entry.colaction = dateConvFormat1(entry.START_DATE);
                    entry.AVAIL_SEAT = "";
                    entry.COUNT_ON_WAITLIST = "";
                    entry.SCTN_CPCTY_QTY = "";

                    if (undefined == cateObj['catePBF'
                        + sectCodeCh])
                    {
                        cateObj['catePBF'
                            + sectCodeCh] = [];
                    }

                    cateObj['catePBF'
                        + sectCodeCh].push(entry);
                    return;
                }

                // midterm - can be multiple
                if ('MI' == entry.FK_SPM_SPCL_MTG_CD)
                {
                    entry.colaction = dateConvFormat1(entry.START_DATE);
                    entry.AVAIL_SEAT = "";
                    entry.COUNT_ON_WAITLIST = "";
                    entry.SCTN_CPCTY_QTY = "";
                    if (undefined == cateObj['cateMI'
                        + sectCodeCh])
                    {
                        cateObj['cateMI'
                            + sectCodeCh] = [];
                    }
                    cateObj['cateMI'
                        + sectCodeCh].push(entry);
                    return;
                }

                // final
                if ('FI' == entry.FK_SPM_SPCL_MTG_CD)
                {
                    entry.colaction = dateConvFormat1(entry.START_DATE);
                    entry.AVAIL_SEAT = "";
                    entry.COUNT_ON_WAITLIST = "";
                    entry.SCTN_CPCTY_QTY = "";
                    cateObj['cateFI'
                        + sectCodeCh] = entry;
                    return;
                }

                // ------- non final below -----------------------//

                // seats ,
                if ('NC' == entry.FK_SST_SCTN_STATCD)
                {
                    entry.SECTION_NUMBER = "";
                    entry.AVAIL_SEAT = "";
                    entry.COUNT_ON_WAITLIST = "";
                    entry.SCTN_CPCTY_QTY = "";
                }
                else if ('Y' == entry.STP_ENRLT_FLAG.trim().toUpperCase())
                {
                    entry.AVAIL_SEAT = 0;
                }

                if (9999 == entry.SCTN_CPCTY_QTY)
                {
                    entry.SCTN_CPCTY_QTY = "No<br />Limit";
                    entry.AVAIL_SEAT = "<b>";
                }
                // CA cases
                if ('CA' == entry.FK_SST_SCTN_STATCD)
                {
                    entry.COL_SPAN_DAYS = 10;
                    entry.DAY_CODE = "cancelled";
                }
                // sect code
                if (sectCodeCh.match(/^\d$/))
                {
                    if (-1 == $.inArray('0', sectChArr))
                    {
                        sectChArr.push('0');
                    }
                    filterLeftNum0N++;
                    if (undefined == cateObj['cate0N'])
                    {
                        cateObj['cate0N'] = [];
                    }
                    cateObj['cate0N'].push(entry);

                }
                else
                {
                    // FI and MI are handled above
                    if (sectCode == sectCodeCh
                        + '00')
                    {
                        filterLeftNum00++;
                        cateObj['cate'
                            + sectCodeCh
                            + '0'] = entry;
                    }
                    else
                    {
                        filterLeftNum0X++;
                        if (undefined == cateObj['cate'
                            + sectCodeCh
                            + 'X'])
                        {
                            cateObj['cate'
                                + sectCodeCh
                                + 'X'] = [];
                        }
                        cateObj['cate'
                            + sectCodeCh
                            + 'X'].push(entry);
                    }
                }
            });

            // DEBUG
            if (0 == filterLeftNum
                || (0 == filterLeftNum00 && 0 == filterLeftNum))
            {
                sGridObj.jqGrid("groupingToggle", groupId);
                return;
            }

            var crseHeaderObj = {
                'SECTION_NUMBER' : 'Section ID',
                'SECT_CODE' : 'Section',
                'FK_CDI_INSTR_TYPE' : 'Meeting\nType',
                'DAY_CODE' : 'Days',
                'coltime' : 'Time',
                'BLDG_CODE' : 'Building',
                'ROOM_CODE' : 'Room',
                'AVAIL_SEAT' : 'Avail\nSeats',
                'SCTN_CPCTY_QTY' : 'Total\nSeats',
                'COUNT_ON_WAITLIST' : 'Waitlist\nCount',
                'BOOK_LINK' : 'Book',
                'PERSON_FULL_NAME' : 'Instructor',
                'colaction' : 'Action',
                'ROW_MARKER' : 1,
                'colsubj' : thisGroup.colsubj,
                'SUBJ_CODE' : subjCode,
                'CRSE_CODE' : crseCode,
                'SORT_KEY' : ++cateObj['ASortKey'],
                // defaults
                'ROW_SPAN' : 1,
                'ROW_COUP' : 0,
                'ROW_SPAN_INST' : 1,
                'COL_SPAN' : 1,
                'COL_SPAN_SC' : 1,
                'COL_SPAN_DAYS' : 1,
                'ROW_ATTR' : {
                    'rowClass' : 'wr-search-group-member-header'
                }
            };
            pushData2.push(crseHeaderObj);

            // crse text
            var crseTextBody = "";
            var tmp = subjCode
                + "-"
                + crseCode;
            $.each(subjCrseTextList, function(i, entry)
            {
                if (entry.SUBJCRSE == tmp)
                {
                    crseTextBody = crseTextBody
                        + " "
                        + entry.TEXT.trim();
                    crseTextBody = crseTextBody.replace(/\\/g, '<br>');
                }
            });

            if ("" != crseTextBody)
            {
                var crseTextHead = "&nbsp;&nbsp;&nbsp;&nbsp;<img style='vertical-align:middle;' src='/webreg2/resources/images/info.png'><span style='; line-height:100%; vertical-align: middle;'><b> Course Note:</b> ";
                var crseTextTail = "</span>";
                var crseText = crseTextHead
                    + crseTextBody
                    + crseTextTail;

                var crseTextObj = {
                    'SORT_KEY' : ++cateObj['ASortKey'],
                    'SECTION_NUMBER' : crseText,
                    'ROW_MARKER' : 1,
                    'colsubj' : thisGroup.colsubj,
                    'SUBJ_CODE' : subjCode,
                    'CRSE_CODE' : crseCode,
                    'COL_SPAN' : 13,
                    'COL_SPAN_SC' : 1,
                    'COL_SPAN_DAYS' : 1,
                    'ROW_ATTR' : {
                        'rowClass' : 'wr-search-group-crse-text'
                    },
                    // defaults
                    'colaction' : '',
                    'ROW_SPAN' : 1,
                    'ROW_COUP' : 0,
                    'ROW_SPAN_INST' : 1
                };
                pushData2.push(crseTextObj);

            }

            // section text
            if (sectNumList.length > 0)
            {
                var sectNumListStr = sectNumList.join(":");
                var sectionTextList = {};

                wrapperSearchGetSectionText(sectNumListStr, function(data)
                {
                    $.each(data, function(i, entry)
                    {
                        if (entry.SECTNUM in sectionTextList)
                        {
                            sectionTextList[entry.SECTNUM] = sectionTextList[entry.SECTNUM]
                                + " "
                                + entry.TEXT.trim();
                        }
                        else
                        {
                            sectionTextList[entry.SECTNUM] = entry.TEXT.trim();
                        }
                    });
                });
            }

            var insertSectionText = function(sectNum, sortKey, sectTextBody)
            {
                var sectText = "";
                var sectTextHead = "<img style='vertical-align:middle;' src='/webreg2/resources/images/info.png'><span style='; line-height:100%; vertical-align: middle;'> <b>Section "
                    + sectNum
                    + " Note:</b> ";
                var sectTextTail = "</span>";
                var sectText = sectTextHead
                    + sectTextBody
                    + sectTextTail;
                var sectionTextObj = {
                    'SORT_KEY' : sortKey,
                    'SECTION_NUMBER' : '',
                    'SECT_CODE' : sectText,
                    'ROW_MARKER' : 1,
                    'colsubj' : thisGroup.colsubj,
                    'SUBJ_CODE' : subjCode,
                    'CRSE_CODE' : crseCode,
                    'COL_SPAN' : 1,
                    'COL_SPAN_SC' : 12, // sect code
                    'COL_SPAN_DAYS' : 1,
                    'ROW_ATTR' : {
                        'rowClass' : 'wr-search-group-section-text'
                    },
                    'colaction' : '',
                    'ROW_SPAN' : 1,
                    'ROW_COUP' : 0,
                    'ROW_SPAN_INST' : 1
                };
                pushData2.push(sectionTextObj);
            };

            // loop3 --------------------------------------
            // build row data

            var ncHeaderObj = {
                'SECTION_NUMBER' : 'Note: The following is an additional required meeting type for the above courses.',

                'ROW_MARKER' : 1,
                'colsubj' : thisGroup.colsubj,
                'SUBJ_CODE' : subjCode,
                'CRSE_CODE' : crseCode,
                'COL_SPAN' : 13,
                'COL_SPAN_SC' : 1,
                'COL_SPAN_DAYS' : 1,
                'ROW_ATTR' : {
                    'rowClass' : 'wr-search-nc-header-row'
                },
                'colaction' : '',
                'ROW_SPAN' : 1,
                'ROW_COUP' : 0,
                'ROW_SPAN_INST' : 1
            };

            /** * >>>classlink - subj/crse specific ***************** */

            var classLinkPre = '';
            wrapperGetPrerequisites(subjCode, crseCode, function(data)
            {

                if (data.length > 0)
                {
                    classLinkPre = '<span class="prereqs-bar prereqs-bar-crse-'
                        + subjCode.trim()
                        + crseCode.trim()
                        + '">Prerequisites</span> | ';
                }

                // data passed to this onClick
                var passedData = {
                    subjCode : subjCode, crseCode : crseCode, resData : data
                };
                $('#search-div-b-table').on('click', '.prereqs-bar-crse-'
                    + subjCode.trim()
                    + crseCode.trim(), passedData, showPrereqsDialog);

            });

            var classLinkEva = 'https://academicaffairs.ucsd.edu/Modules/Evals/SET/Reports/Search.aspx?courseNumber='
                + subjCode
                + '+'
                + crseCode;

            var tmpCata = '';

            // restriction
            var classLinkRestrict = "";

            wrapperSearchGetRestriction(subjCode, crseCodeWellForm, function(data)
            {

                if (data.length <= 0)
                {
                    return;
                }

                var resAll = undefined;
                var dept = false;
                var restrictions = [];
                var pushData = []

                var resDept = 'Department Approval Required';
                var co = "College";
                var ma = "Major";
                var lv = "Academic Level";
                var cl = "Class Level";

                $.each(data, function(index, entry)
                {

                    switch (entry.CRSE_REGIS_TYPE_CD)
                    {
                        case "OT":
                            dept = true;
                            break;

                        case "MA":
                            if (restrictions.indexOf(ma) == -1)
                            {
                                restrictions.push(ma);
                                pushData.push(entry.CRSE_REGIS_TYPE_CD);
                            }
                            break;

                        case "CO":
                            if (restrictions.indexOf(co) == -1)
                            {
                                restrictions.push(co);
                                pushData.push(entry.CRSE_REGIS_TYPE_CD);
                            }
                            break;

                        case "CL":
                            if (restrictions.indexOf(cl) == -1)
                            {
                                restrictions.push(cl);
                                pushData.push(entry.CRSE_REGIS_TYPE_CD);
                            }

                            break;
                        case "LV":
                            if (restrictions.indexOf(lv) == -1)
                            {
                                restrictions.push(lv);
                                pushData.push(entry.CRSE_REGIS_TYPE_CD);
                            }
                            break;

                    }

                });

                switch (restrictions.length)
                {
                    case 0:
                        break;
                    case 1:
                        resAll = "Restricted by "
                            + restrictions[0];
                        break;
                    case 2:
                        resAll = "Restricted by "
                            + restrictions[0]
                            + " and "
                            + restrictions[1];
                        break;
                    case 3:
                        resAll = "Restricted by "
                            + restrictions[0]
                            + ", "
                            + restrictions[1]
                            + " and "
                            + restrictions[2];
                        break;
                    case 4:
                        resAll = "Restricted by "
                            + restrictions[0]
                            + ", "
                            + restrictions[1]
                            + ", "
                            + restrictions[2]
                            + " and "
                            + restrictions[3];
                        break;
                }

                if (dept)
                {
                    classLinkRestrict = "<span class='dept-approval-class'>Department Approval Required</span> | ";
                }

                if (resAll != undefined)
                {
                    classLinkRestrict += '<span class="restrictions-bar restrictions-bar-crse-'
                        + subjCode.trim()
                        + crseCodeWellForm.trim()
                        + '">'
                        + resAll
                        + ' </span> | ';
                }

                // data passed to this onClick
                var passedData = {
                    subjCode : subjCode, crseCode : crseCodeWellForm, resData : pushData
                };
                $('#search-div-b-table').on('click', '.restrictions-bar-crse-'
                    + subjCode.trim()
                    + crseCodeWellForm.trim(), passedData, showRestrictionDialog);

            });

            wrapperSearchGetCatalog(subjCode, crseCodeWellForm, function(data)
            {
                if (undefined != data.CATALOG_DATA)
                {
                    tmpCata = data.CATALOG_DATA.trim().toUpperCase();
                }
            });

            var classLinkCata = '';
            if ('RESEARCH' == tmpCata
                || 'EXCLUDE' == tmpCata)
            {
                classLinkCata = '';
            }
            else if ('CLPH' == tmpCata)
            {
                classLinkCata = 'http://pharmacy.ucsd.edu/prospective/curriculum.shtml';
            }
            else if ('EAP' == tmpCata)
            {
                classLinkCata = 'http://www.ucsd.edu/catalog/courses/EAP.html';
            }
            else if ('DNP' == tmpCata)
            {
                classLinkCata = 'http://registrar.ucsd.edu/studentlink/cnd.html';
            }
            else
            {
                classLinkCata = 'http://www.ucsd.edu/catalog/courses/'
                    + tmpCata
                    + '.html#'
                    + subjCode.toLowerCase()
                    + crseCode.toLowerCase();
            }

            // start and end date string
            var groupDateStr = "";
            if (isSummerSession)
            {
                groupDateStr = " "
                    + termCodeText
                    + ": "
                    + dateConvFormat2(groupStartDate)
                    + " - "
                    + dateConvFormat2(groupEndDate);
            }

            $.each(sectChArr, function(t, sectCh)
            {
                var cateAnyNumAC = cateObj['cateNumAC'
                    + sectCh];
                var cateAny0 = cateObj['cate'
                    + sectCh
                    + '0'];
                if (undefined == cateObj['cate'
                    + sectCh
                    + 'X'])
                {
                    cateObj['cate'
                        + sectCh
                        + 'X'] = [];
                }
                var cateAnyX = cateObj['cate'
                    + sectCh
                    + 'X'];
                var cateAnyN = cateObj['cate0N']; // num classes
                var cateAnyM = cateObj['cateMI'
                    + sectCh]; // midterm
                var cateAnyF = cateObj['cateFI'
                    + sectCh]; // final
                var cateAnyPBF = cateObj['catePBF'
                    + sectCh]; // PBF

                if (sectCh.match(/[B-Z]/))
                {
                    cateObj[sectCh
                        + 'SortKey'] = (sectCh.charCodeAt(0) - 64) * 1000;
                }
                else if (sectCh == '0')
                {
                    cateObj[sectCh
                        + 'SortKey'] = (91 - 64) * 1000; // after Z
                }

                // classlink - section specific ******************/
                var classLinkRes = 'http://courses.ucsd.edu/courseList.aspx?name='
                    + subjCode; // fall-back
                if (undefined != cateAny0)
                {
                    if (cateAny0.ORG_SECTION_NUMBER.toString().match(/^\d+$/))
                    {
                        classLinkRes = 'http://courses.ucsd.edu/coursemain.aspx?section='
                            + cateAny0.ORG_SECTION_NUMBER;
                    }
                }
                else if (undefined != cateAnyN
                    && undefined != cateAnyN[0])
                {
                    if (cateAnyN[0].ORG_SECTION_NUMBER.toString().match(/^\d+$/))
                    {
                        classLinkRes = 'http://courses.ucsd.edu/coursemain.aspx?section='
                            + cateAnyN[0].ORG_SECTION_NUMBER;
                    }
                }

                var tmp1 = '<a target="_blank" href="'
                    + classLinkCata
                    + '" >Catalog</a> | ';
                if ('' == classLinkCata.trim())
                {
                    tmp1 = '';
                }

                var classLinkHtml = '<table width="100%"><tr><td style="border-right-style: none" >'
                    + groupDateStr
                    + '<td><span style="float: right; margin: 0px;">'
                    + classLinkRestrict
                    + tmp1
                    + classLinkPre
                    + '<a target="_blank" href="'
                    + classLinkRes
                    + '">Resources</a>  | '
                    + '<a target="_blank" href="'
                    + classLinkEva
                    + '">Evaluations</a> '
                    + '</span></td></tr></table>'

                var classLinkObj = {
                    'SECTION_NUMBER' : classLinkHtml,
                    'ROW_MARKER' : 1,
                    'colsubj' : thisGroup.colsubj,
                    'SUBJ_CODE' : subjCode,
                    'CRSE_CODE' : crseCode,
                    'COL_SPAN' : 13,
                    'COL_SPAN_SC' : 1,
                    'COL_SPAN_DAYS' : 1,
                    'ROW_ATTR' : {
                        'rowClass' : 'wr-search-group-classlink-row'
                    },
                    'colaction' : '',
                    'ROW_SPAN' : 1,
                    'ROW_COUP' : 0,
                    'ROW_SPAN_INST' : 1
                };

                var classLinkObjCopy = $.extend(true, {}, classLinkObj);
                classLinkObjCopy.SORT_KEY = ++cateObj[sectCh
                    + 'SortKey'];

                if ('0' != sectCh)
                {

                    if (undefined != cateAny0
                        && cateAny0.FK_SST_SCTN_STATCD == 'AC')
                    {
                        pushData2.push(classLinkObjCopy);

                        // search section number must exists for plan button
                        // event
                        cateAny0.SECTION_HEAD = cateAny0.SECTION_NUMBER.toString().match(/^\s*$/) ? cateAny0.ORG_SECTION_NUMBER : cateAny0.SECTION_NUMBER

                        cateAny0.SECTION_HEAD_CODE = cateAny0.SECT_CODE;

                        cateAny0.colaction = setSearchBut(
                            cateAny0.SECTION_HEAD,
                            cateAny0.AVAIL_SEAT,
                            cateAny0.STP_ENRLT_FLAG,
                            cateAny0.SUBJ_CODE,
                            cateAny0.CRSE_CODE,
                            cateAny0.BUTTON_ACTION,
                            groupButtonAction);

                        cateAny0.SORT_KEY = ++cateObj[sectCh
                            + 'SortKey'];
                        cateAny0.ROW_ATTR.rowClass = cateAny0.ROW_ATTR.rowClass
                            + ' wr-search-ac-alone ';

                        pushData2.push(cateAny0);
                        var tmpSectNum = cateAny0.SECTION_NUMBER;
                        if (tmpSectNum in sectionTextList)
                        {

                            cateAny0.ROW_ATTR.rowClass = cateAny0.ROW_ATTR.rowClass
                                + ' wr-search-group-section-text-owner ';

                            insertSectionText(cateAny0.SECT_CODE, ++cateObj[sectCh
                                + 'SortKey'], sectionTextList[tmpSectNum]);
                        }

                        // These are all non-AC's beause cateAny0 is AC - just
                        // list them

                        // ncHeader

                        if (cateAnyX.length > 0
                            && 'CA' != cateAnyX[0].FK_SST_SCTN_STATCD)
                        {
                            var ncHeaderObjTmp = $.extend(true, {}, ncHeaderObj);
                            ncHeaderObjTmp.SORT_KEY = ++cateObj[sectCh
                                + 'SortKey'];
                            pushData2.push(ncHeaderObjTmp);
                        }

                        var nonCancelEntries = 0;
                        $.each(cateAnyX, function(index, entry)
                        {
                            var tmpSectNum = entry.ORG_SECTION_NUMBER;

                            // disable dup info
                            entry.AVAIL_SEAT = "";
                            entry.SCTN_CPCTY_QTY = "";
                            entry.SECTION_NUMBER = "";

                            if (index == cateAnyX.length - 1)
                            { // last

                                entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                                    + ' wr-search-nc-alone-last ';

                            }
                            else
                            {

                                // if next one is cancel, ...
                                if (cateAnyX[index + 1].FK_SST_SCTN_STATCD)
                                {
                                    entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                                        + ' wr-search-nc-alone-before-cancel ';
                                }
                                else
                                {
                                    entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                                        + ' wr-search-nc-alone ';
                                }
                            }

                            entry.SORT_KEY = ++cateObj[sectCh
                                + 'SortKey'];
                            pushData2.push(entry);
                            if (tmpSectNum in sectionTextList)
                            {

                                entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                                    + ' wr-search-group-section-text-owner ';

                                insertSectionText(entry.SECT_CODE, ++cateObj[sectCh
                                    + 'SortKey'], sectionTextList[tmpSectNum]);
                            }
                        });

                    }
                    else if (undefined != cateAny0
                        && cateAny0.FK_SST_SCTN_STATCD != 'AC')
                    {
                        pushData2.push(classLinkObjCopy);
                        var firstLecture = true; // so non-enrolled LE
                        // section notes only show
                        // once at the top
                        var display00 = true;
                        // save a position
                        var display00SortKey = ++cateObj[sectCh
                            + 'SortKey'];

                        var ncHeaderPut = false;
                        $.each(cateAnyX, function(index, entry)
                        {
                            var entryAC = entry.FK_SST_SCTN_STATCD == 'AC' ? true : false;

                            if (entryAC)
                            { // couple search
                                ncHeaderPut = false;

                                // if we pair, don't display extra 00
                                display00 = false;

                                var zeroObj = $.extend(true, {}, cateAny0);
                                zeroObj.ROW_SPAN = 2;
                                zeroObj.ROW_COUP = 1; // top
                                entry.ROW_COUP = 2; // bottom

                                // action
                                zeroObj.SECTION_NUMBER = entry.SECTION_NUMBER;
                                zeroObj.SECTION_HEAD = entry.SECTION_NUMBER.toString().match(/^\s*$/) ? entry.ORG_SECTION_NUMBER : entry.SECTION_NUMBER
                                zeroObj.SECTION_HEAD_CODE = entry.SECT_CODE;

                                zeroObj.colaction = setSearchBut(
                                    entry.ORG_SECTION_NUMBER,
                                    entry.AVAIL_SEAT,
                                    entry.STP_ENRLT_FLAG,
                                    entry.SUBJ_CODE,
                                    entry.CRSE_CODE,
                                    entry.BUTTON_ACTION,
                                    groupButtonAction);
                                zeroObj.ROW_ATTR.rowClass = zeroObj.ROW_ATTR.rowClass
                                    + ' wr-search-batch-middle ';

                                if (zeroObj.PERSON_FULL_NAME == entry.PERSON_FULL_NAME)
                                {
                                    entry.PERSON_FULL_NAME = "";
                                    zeroObj.ROW_SPAN_INST = 2;
                                }

                                var tmpSectNum = zeroObj.ORG_SECTION_NUMBER;
                                if (tmpSectNum in sectionTextList
                                    && firstLecture)
                                {
                                    firstLecture = false;
                                    zeroObj.ROW_ATTR.rowClass = zeroObj.ROW_ATTR.rowClass
                                        + ' wr-search-group-section-text-owner ';
                                    insertSectionText(zeroObj.SECT_CODE, ++cateObj[sectCh
                                        + 'SortKey'], sectionTextList[tmpSectNum]);
                                }
                                zeroObj.SORT_KEY = ++cateObj[sectCh
                                    + 'SortKey'];
                                pushData2.push(zeroObj);

                                if ('CA' != entry.FK_SST_SCTN_STATCD)
                                {
                                    entry.ROW_SPAN = 0;
                                }

                            }
                            else
                            { // all NC cases
                                if ('CA' != entry.FK_SST_SCTN_STATCD)
                                {
                                    if (!ncHeaderPut)
                                    {
                                        var ncHeaderObjTmp = $.extend(true, {}, ncHeaderObj);
                                        ncHeaderObjTmp.SORT_KEY = ++cateObj[sectCh
                                            + 'SortKey'];
                                        pushData2.push(ncHeaderObjTmp);
                                        ncHeaderPut = true;
                                    }

                                    if (index == cateAnyX.length - 1)
                                    { // last
                                        entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                                            + ' wr-search-nc-alone-last ';
                                    }
                                    else
                                    {
                                        entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                                            + ' wr-search-nc-alone ';
                                    }
                                }
                                else
                                {

                                    if (entry.BEFORE_DESC.trim() == 'AC')
                                    {

                                        // ///
                                        display00 = false;

                                        var zeroObj = $.extend(true, {}, cateAny0);
                                        zeroObj.ROW_SPAN = 2;
                                        zeroObj.ROW_COUP = 1; // top
                                        entry.ROW_COUP = 2; // bottom

                                        // action
                                        zeroObj.SECTION_NUMBER = entry.SECTION_NUMBER;
                                        zeroObj.SECTION_HEAD = entry.SECTION_NUMBER.toString().match(/^\s*$/) ? entry.ORG_SECTION_NUMBER : entry.SECTION_NUMBER
                                        zeroObj.SECTION_HEAD_CODE = entry.SECT_CODE;

                                        // zeroObj.PERSON_FULL_NAME = "";
                                        zeroObj.COL_SPAN_DAYS = 10;
                                        zeroObj.ROW_SPAN_DAYS = 2;
                                        zeroObj.DAY_CODE = entry.DAY_CODE;
                                        // zeroObj.ROW_SPAN_INST= 2;

                                        zeroObj.ROW_ATTR.rowClass = zeroObj.ROW_ATTR.rowClass
                                            + ' wr-search-batch-middle-cancelled ';
                                        zeroObj.SORT_KEY = ++cateObj[sectCh
                                            + 'SortKey'];

                                        pushData2.push(zeroObj);

                                        entry.ROW_SPAN = 0;

                                    }
                                    else
                                    {
                                        entry.SECTION_NUMBER = ""; // don't
                                        // show
                                        // section
                                        // numbers
                                        // for
                                        // cancelled
                                        // NC
                                        // sections
                                    }

                                    if (index == cateAnyX.length - 1)
                                    { // last
                                        entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                                            + ' wr-search-nc-alone-last ';
                                    }
                                    else
                                    {
                                        entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                                            + ' wr-search-nc-alone ';
                                    }
                                }
                            }

                            entry.SORT_KEY = ++cateObj[sectCh
                                + 'SortKey'];
                            pushData2.push(entry);

                            var tmpSectNum = entry.ORG_SECTION_NUMBER;
                            if (tmpSectNum in sectionTextList)
                            {
                                entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                                    + ' wr-search-group-section-text-owner ';
                                insertSectionText(entry.SECT_CODE, ++cateObj[sectCh
                                    + 'SortKey'], sectionTextList[tmpSectNum]);
                            }
                        });

                        if (display00)
                        { // push to top
                            if ('CA' != cateAny0.FK_SST_SCTN_STATCD)
                            {
                                cateAny0.ROW_ATTR.rowClass = cateAny0.ROW_ATTR.rowClass
                                    + ' wr-search-nc-alone ';
                            }
                            cateAny0.SORT_KEY = display00SortKey;
                            pushData2.push(cateAny0);
                        }
                    }
                }
                else
                { // num classes case - ANTH 295 -- just list them
                    pushData2.push(classLinkObjCopy);

                    $.each(cateAnyN, function(index, entry)
                    {
                        entry.SORT_KEY = ++cateObj[sectCh
                            + 'SortKey'];
                        entry.SECTION_HEAD = entry.SECTION_NUMBER.toString().match(/^\s*$/) ? entry.ORG_SECTION_NUMBER : entry.SECTION_NUMBER
                        entry.SECTION_HEAD_CODE = entry.SECT_CODE;

                        if (entry.FK_SST_SCTN_STATCD == 'NC')
                        {
                            if (undefined != cateObj['cateNum']
                                && index == cateObj['cateNum'].length - 1)
                            { // last
                                entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                                    + ' wr-search-nc-alone-last ';
                            }
                            else
                            {
                                entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                                    + ' wr-search-nc-alone ';
                            }
                        }
                        else if (entry.FK_SST_SCTN_STATCD == 'AC')
                        {
                            entry.colaction = setSearchBut(
                                entry.SECTION_HEAD,
                                entry.AVAIL_SEAT,
                                entry.STP_ENRLT_FLAG,
                                entry.SUBJ_CODE,
                                entry.CRSE_CODE,
                                entry.BUTTON_ACTION,
                                groupButtonAction);
                        }
                        pushData2.push(entry);

                        var tmpSectNum = entry.SECTION_NUMBER;
                        if (tmpSectNum in sectionTextList)
                        {
                            entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                                + ' wr-search-group-section-text-owner ';
                            insertSectionText(entry.SECT_CODE, ++cateObj[sectCh
                                + 'SortKey'], sectionTextList[tmpSectNum]);
                        }

                    });
                }

                // PBF
                if (null != cateAnyPBF)
                {
                    var preEntry = null;
                    $.each(cateAnyPBF, function(index, entry)
                    {

                        var tmp0 = entry.SECTION_NUMBER
                            + "-"
                            + entry.FK_SPM_SPCL_MTG_CD;

                        if (0 == index
                            || 1 == cateAnyPBF.length
                            || (null != preEntry
                                && undefined != preEntry.FK_SPM_SPCL_MTG_CD && preEntry.FK_SPM_SPCL_MTG_CD != entry.FK_SPM_SPCL_MTG_CD))
                        {
                            var tmpObj = $.extend(true, {}, entry);

                            tmpObj.SEARCH_PBF_ID = tmp0;

                            var tmp2 = "<img class='search-pbf-header-class' id='search-pbf-id-"
                                + tmpObj.SEARCH_PBF_ID
                                + "' alt='Expand: ' src='"
                                + imgRight
                                + "' "
                                + " style=' width:8px; height:8px; margin-right: 2px; margin-top: 5px;' ></img> "

                            tmpObj.SECTION_NUMBER = "<div style='width:100%; text-align:left' class='search-outer-pbf-header-class' id='search-outer-pbf-id-"
                                + tmpObj.SEARCH_PBF_ID
                                + "'>"
                                + tmp2
                                + convInstType(entry.FK_SPM_SPCL_MTG_CD)
                                + "</div>";

                            tmpObj.COL_SPAN = 13;
                            tmpObj.SORT_KEY = ++cateObj[sectCh
                                + 'SortKey'];
                            pushData2.push(tmpObj);

                        }

                        entry.SECTION_NUMBER = '';
                        entry.SECT_CODE = '';
                        entry.FK_CDI_INSTR_TYPE = entry.FK_SPM_SPCL_MTG_CD;
                        entry.SCTN_CPCTY_QTY = "";
                        entry.AVAIL_SEAT = "";
                        entry.COUNT_ON_WAITLIST = '';
                        entry.BOOK_LINK = '';
                        entry.PERSON_FULL_NAME = '';
                        entry.SORT_KEY = ++cateObj[sectCh
                            + 'SortKey'];
                        entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                            + ' search-pbf-class search-pbf-class-'
                            + tmp0;

                        pushData2.push(entry);

                        preEntry = entry;
                    });

                }

                // midterm
                if (null != cateAnyM)
                {
                    $.each(cateAnyM, function(index, entry)
                    {
                        entry.SECT_CODE = '';
                        entry.FK_CDI_INSTR_TYPE = '';
                        entry.PERSON_FULL_NAME = '';
                        entry.SECTION_NUMBER = '<span style="font-weight:bold;color:black">MIDTERM</span>';
                        entry.AVAIL_SEAT = "";
                        entry.SCTN_CPCTY_QTY = "";
                        entry.SORT_KEY = ++cateObj[sectCh
                            + 'SortKey'];
                        pushData2.push(entry);
                    });
                }

                // final row
                if (null != cateAnyF)
                {
                    if (!finalLocationDisplay)
                    {
                        cateAnyF.ROOM_CODE = 'TBA';
                        cateAnyF.BLDG_CODE = 'TBA';
                    }
                    cateAnyF.SECT_CODE = '';
                    cateAnyF.FK_CDI_INSTR_TYPE = '';
                    cateAnyF.PERSON_FULL_NAME = '';
                    cateAnyF.SECTION_NUMBER = '<span style="font-weight:bold;color:black">FINAL</span>';
                    cateAnyF.AVAIL_SEAT = "";
                    cateAnyF.SCTN_CPCTY_QTY = "";
                    cateAnyF.SORT_KEY = ++cateObj[sectCh
                        + 'SortKey'];
                    pushData2.push(cateAnyF);
                }

            }); // data loop 3

            // loop 4
            $.each(pushData2, function(index, entry)
            {
                if (undefined != entry.SECTION_NUMBER
                    && entry.SECTION_NUMBER.toString().match(/^\s*\d{6}\s*$/)
                    && (null != entry.LONG_DESC)
                    && (!entry.LONG_DESC.match(/^\s*$/)))
                {
                    entry.SECTION_NUMBER = entry.SECTION_NUMBER
                        + "\n"
                        + entry.LONG_DESC.trim();
                    entry.ROW_ATTR.rowClass = entry.ROW_ATTR.rowClass
                        + ' wr-search-subtitle ';
                }
            });

            var tmpArr = sLocalData.concat(pushData2);
            sLocalData.length = 0;
            sLocalData = tmpArr;

            searchReloadGrid(false, sGridObj, sLocalData, groupId);

            searchInstallHandler(sLocalData);

            searchDisableBut();

            sGridObj.jqGrid("groupingToggle", groupId);

            $(".search-pbf-class").hide(); // must be after toggle
        });
}

function showPrereqsDialog(data)
{
    $('#dialog-prereqs').dialog('open');

    var pData = data.data;
    var tipMsg = "";
    var courseMsg = "<div class='msg info'><h4>Course Prerequisites:</h4><ol><li><ul>";
    var testMsg = "<div class='msg info'><h4>Test requirements can be satisfied with qualifying scores on any of the following exams:</h4><ul>";
    var showCourse = false;
    var showTest = false;
    var currentGroup = "";
    $.each(pData.resData, function(index, entry)
    {
        var something;
        if (entry.TYPE == "TEST")
        {
            testMsg += "<li>"
                + entry.TEST_TITLE
                + "</li>";
            showTest = true;
        }
        else if (entry.TYPE == "COURSE")
        {
            if (currentGroup != entry.PREREQ_SEQ_ID)
            {
                if (currentGroup !== "")
                {
                    courseMsg += "</ul></li><hr /><li><ul>";
                }
                currentGroup = entry.PREREQ_SEQ_ID;
            }
            else
            {
                courseMsg += "<span class='prereq-or'>OR</span>";
            }
            courseMsg += "<li>"
                + entry.SUBJECT_CODE
                + ": "
                + entry.COURSE_CODE
                + " - "
                + entry.CRSE_TITLE
                + "</li>";
            showCourse = true;
        }
    });
    courseMsg += "</ul></li></ol></div>";
    testMsg += "</ul></div>";
    tipMsg += showCourse ? courseMsg : "";
    tipMsg += showTest ? testMsg : "";

    updateTips(tipMsg);
}

function showRestrictionDialog(data)
{
    $('#dialog-restrictions').dialog('open');

    var tipMsg = "<div class='msg info'><h4>Course Restrictions</h4><br />";

    var resOrg = {};
    var pData = data.data;

    $.each(pData.resData, function(index, entry)
    {
        switch (entry)
        {
            case 'MA': // major
                wrapperGetMajorRestrictions(pData.subjCode, pData.crseCode, function(data)
                {

                    var unique = [];
                    var iStr = "<h5>Open to majors:</h5><ul>";
                    var xStr = "<h5>Not open to majors:</h5><ul>";
                    var fi = true;
                    var fx = true;
                    $.each(data, function(index, entry)
                    {

                        // no duplicate majors
                        if (unique.indexOf(entry.NAME.trim()) !== -1)
                        {
                            return;
                        }

                        if (entry.CRSE_REGIS_FLAG == 'I')
                        {
                            iStr += '<li>'
                                + entry.NAME.trim()
                                + '</li>'
                            fi = false;
                        }
                        else
                        {
                            xStr += '<li>'
                                + entry.NAME.trim()
                                + '</li>';
                            fx = false;
                        }
                        unique.push(entry.NAME.trim());
                    });
                    if (!fi)
                    {
                        iStr += "</ul>";
                        tipMsg += iStr;
                    }
                    if (!fx)
                    {
                        xStr += "</ul>";
                        tipMsg += xStr;
                    }
                });
                break;
            case 'CO': // college
                wrapperGetCollegeRestrictions(pData.subjCode, pData.crseCode, function(data)
                {

                    var unique = [];
                    var iStr = "<h5>Open to colleges:</h5><ul>";
                    var xStr = "<h5>Not open to colleges:</h5><ul>";
                    var fi = true;
                    var fx = true;
                    $.each(data, function(index, entry)
                    {

                        // no duplicate majors
                        if (unique.indexOf(entry.NAME.trim()) !== -1)
                        {
                            return;
                        }

                        if (entry.CRSE_REGIS_FLAG == 'I')
                        {
                            iStr += '<li>'
                                + entry.NAME.trim()
                                + '</li>'
                            fi = false;
                        }
                        else
                        {
                            xStr += '<li>'
                                + entry.NAME.trim()
                                + '</li>'
                            fx = false;
                        }
                        unique.push(entry.NAME.trim());
                    });
                    if (!fi)
                    {
                        iStr += "</ul>";
                        tipMsg += iStr;
                    }
                    if (!fx)
                    {
                        xStr += "</ul>";
                        tipMsg += xStr;
                    }
                });

                break;
            case 'CL': // class level
                wrapperGetClassLevelRestrictions(pData.subjCode, pData.crseCode, function(data)
                {

                    var unique = [];
                    var iStr = "<h5>Open to class levels:</h5><ul>";
                    var xStr = "<h5>Not open to class levels:</h5><ul>";
                    var fi = true;
                    var fx = true;
                    $.each(data, function(index, entry)
                    {

                        // no duplicate majors
                        if (unique.indexOf(entry.NAME.trim()) !== -1)
                        {
                            return;
                        }

                        if (entry.CRSE_REGIS_FLAG == 'I')
                        {
                            iStr += '<li>'
                                + entry.NAME.trim()
                                + '</li>'
                            fi = false;
                        }
                        else
                        {
                            xStr += '<li>'
                                + entry.NAME.trim()
                                + '</li>'
                            fx = false;
                        }
                        unique.push(entry.NAME.trim());
                    });
                    if (!fi)
                    {
                        iStr += "</ul>";
                        tipMsg += iStr;
                    }
                    if (!fx)
                    {
                        xStr += "</ul>";
                        tipMsg += xStr;
                    }
                });
                break;
            case 'LV': // academic level
                wrapperGetAcademicLevelRestrictions(pData.subjCode, pData.crseCode, function(data)
                {
                    var unique = [];
                    var iStr = "<h5>Open to academic levels:</h5><ul> ";
                    var xStr = "<h5>Not open to academic levels:</h5><ul>";
                    var fi = true;
                    var fx = true;
                    $.each(data, function(index, entry)
                    {

                        // no duplicate majors
                        if (unique.indexOf(entry.NAME.trim()) !== -1)
                        {
                            return;
                        }

                        if (entry.CRSE_REGIS_FLAG == 'I')
                        {
                            iStr += '<li>'
                                + entry.NAME.trim()
                                + '</li>'
                            fi = false;
                        }
                        else
                        {
                            xStr += '<li>'
                                + entry.NAME.trim()
                                + '</li>'
                            fx = false;
                        }
                        unique.push(entry.NAME.trim());
                    });
                    if (!fi)
                    {
                        iStr += "</ul>";
                        tipMsg += iStr;
                    }
                    if (!fx)
                    {
                        xStr += "</ul>";
                        tipMsg += xStr;
                    }
                });
                break;
        }
    });

    updateTips(tipMsg);
}

function searchInstallHandler(loadData)
{

    // handler group
    // we can only install handler after grid render
    $.each(loadData, function(i, entry)
    {

        if (undefined != entry.SEARCH_PBF_ID)
        {

            $("#search-outer-pbf-id-"
                + entry.SEARCH_PBF_ID).click(function()
            {

                var curImgSrc = $("#search-pbf-id-"
                    + entry.SEARCH_PBF_ID).attr('src');
                if (curImgSrc === imgDown)
                {
                    $("#search-pbf-id-"
                        + entry.SEARCH_PBF_ID).attr('src', imgRight);
                    $(".search-pbf-class-"
                        + entry.SEARCH_PBF_ID).hide();

                }
                else
                {
                    $("#search-pbf-id-"
                        + entry.SEARCH_PBF_ID).attr('src', imgDown);
                    $(".search-pbf-class-"
                        + entry.SEARCH_PBF_ID).show();
                }
            });
        }

        var sectionHead = entry.SECTION_HEAD;

        if (undefined == sectionHead)
        {
            return;
        }

        var sectionHeadCode = entry.SECTION_HEAD_CODE;

        var subjCode = entry.SUBJ_CODE;
        var crseCode = entry.CRSE_CODE;
        var searchTitle = entry.SEARCH_TITLE;

        $('#search-enroll-id-'
            + sectionHead).button().click(function()
        {
            var buttonRowId = $(this).closest('tr').attr('id');
            classEnrollFun(sectionHead, "enroll", subjCode, crseCode, undefined, searchTitle, buttonRowId);
        });

        $('#search-wait-id-'
            + sectionHead).button().click(function()
        {
            classEnrollFun(sectionHead, "waitlist", subjCode, crseCode, undefined, searchTitle, undefined);
        });

        $('#search-plan-id-'
            + sectionHead).button().click(function()
        {
            classPlanAddFun(sectionHead, sectionHeadCode, subjCode, crseCode, searchTitle);
        });
    });

    $(".email-link-class").click(function()
    {

        var emailRef = $(this).attr('emailref');
        var emailName = $(this).attr('emailname');
        var emailAddr = "none";

        if (emailRef.trim().match(/^[A-z]\d{8}$/))
        {
            wrapperGetInstEmailAddr(emailRef, function(data)
            {
                emailAddr = data.OFFICIAL_EMAIL;
            });
        }
        else
        {
            $("#dialog-msg-small").dialog('open')
            updateTips("No email address found for "
                + emailName);
            return false; // ignore the link
        }

        if (undefined == emailAddr)
        {
            $("#dialog-msg-small").dialog('open')
            updateTips("No email address found for "
                + emailName);
            return false;
        }

        $(this).attr('href', 'mailto:'
            + emailAddr);
    });

}

// disable search
function searchDisableBut()
{

    if (!waitlistAble)
    {
        $('.search-wait-class').button().button('disable');
        $('.search-wait-class').attr('title', notWaitlistableMsg);
    }

    if (enrollAddIsTodayFuture)
    {
        $('.search-plan-class').attr('title', cantPlanMsg);
        $('.search-plan-class').button().button('disable');
    }

    if (!enrollAddIsTodayBetween)
    {
        $('.search-enroll-class').attr('title', notEnrollableMsg);
        $('.search-enroll-class').button().button('disable');
    }

    if (got64)
    {
        // can plan even if appointment time error
        $('.search-enroll-class').attr('title', got64Msg);
        $('.search-enroll-class').button().button('disable');
    }

    // any button
    $('.disableSBClass').button().button('disable');

    if (gotMD)
    {
        $('.search-plan-class').button().button('disable');
        $('.search-plan-class').attr('title', gotMDMsg);
        $('.search-enroll-class').button().button('disable');
        $('.search-enroll-class').attr('title', gotMDMsg);
    }
    else if (got56)
    {
        $('.search-plan-class').attr('title', get56Msg);
        $('.search-plan-class').button().button('disable');
        $('.search-enroll-class').attr('title', get56Msg);
        $('.search-enroll-class').button().button('disable');
    }
    else
    {
        // EnWt button

        if (gotFtype)
        {
            $('.disableSBEnWtClass').button().button('disable');
            $('.disableSBEnWtClass').attr('title', alreadyEnrolledOrWaitlistedMsg);
            $('.disableSBEnClass').button().button('disable');
            $('.disableSBEnClass').attr('title', alreadyEnrolledMsg);
            $('.disableSBWtClass').button().button('disable');
            $('.disableSBWtClass').attr('title', alreadyWaitlistedMsg);
        }

        // Section specific buttons
        $('.disableSBSectionClass').button().button('disable');
        $('.disableSBSectionClass').attr('title', alreadyPlannedEnrolledWaitlistedMsg);

        // enable only if !MD && !got56
        $('.enableSBEnWtClassPreauth').button().button('enable');
        $('.enableSBEnWtClassPreauth').attr('title', preauthEnrollmentMsg);

    }

}

function setSearchBut(sectHead, seat, stopFlag, subjCode, crseCode, buttonAction, groupButtonAction)
{

    var isEnBut = isEnrollOrWaitBut(sectHead, seat, stopFlag, subjCode, crseCode);
    var optAllClass = " subjcrseallclass-"
        + subjCode.trim()
        + crseCode.trim();
    var optPlanClass = " subjcrseplanclass-"
        + subjCode.trim()
        + crseCode.trim();
    var optEnWtClass = " subjcrseenwtclass-"
        + subjCode.trim()
        + crseCode.trim();

    switch (buttonAction)
    {
        case "DISABLE-ALL":
            optAllClass = optAllClass
                + " disableSBClass ";
            break;
        case "DISABLE-ENWT":
            optEnWtClass = " disableSBEnWtClass ";
            break;
        case "DISABLE-SECTION-PL":
            optAllClass = optAllClass
                + " disableSBSectionClass ";
            break;
        case "DISABLE-SECTION-ENWT":
            optAllClass = optAllClass
                + " disableSBSectionClass ";
            break;
    }

    if ("enExist" == groupButtonAction)
    {
        optEnWtClass = optEnWtClass
            + " disableSBEnClass ";
    }
    else if ("wtExist" == groupButtonAction)
    {
        if (!isEnBut)
        {
            optEnWtClass = optEnWtClass
                + " disableSBWtClass ";
        }
    }

    // preauth cases
    if (!got56or64
        && !enrollAddIsTodayBetween)
    {
        var preauthEnable = false;
        $.each(preauthData, function(index, entry)
        {
            var pSubjCode = entry.SUBJ_CODE;
            var pCrseCode = entry.CRSE_CODE;
            var pSectNum = entry.SECTION_NUMBER;
            var orType1 = entry.OVERRIDE_TYPE_1;
            var orType2 = entry.OVERRIDE_TYPE_2;
            var orType3 = entry.OVERRIDE_TYPE_3;

            if (null == pSubjCode
                || null == pCrseCode
                || undefined == pSubjCode
                || undefined == pCrseCode)
            {
                return;
            }
            if (orType1 != 'LA'
                && orType2 != 'LA'
                && orType3 != 'LA')
            {
                return;
            }
            if (!isEnBut)
            {
                return;
            }
            if (entry.SUBJ_CODE.trim() == subjCode
                && entry.CRSE_CODE.trim() == crseCode)
            {
                if (undefined == entry.SECTION_NUMBER)
                {
                    preauthEnable = true; // all button in this subj/crse
                    return false;
                }
                else
                {
                    if (entry.SECTION_NUMBER == sectHead)
                    {
                        preauthEnable = true; // only this button
                        return false;
                    }
                }
            }
        });

        if (preauthEnable)
        {
            optEnWtClass = optEnWtClass
                + " enableSBEnWtClassPreauth ";
        }
    }

    // button search

    if (isEnBut)
    {
        var searchButEnroll = "<input "
            + " id=search-enroll-id-"
            + sectHead
            + " class=' wrbutton wrbuttons wrbuttonspew wrbuttonsr secondary search-enroll-class "
            + optAllClass
            + " "
            + optEnWtClass
            + " ' "
            + " type='button' value='Enroll' />";
    }
    else
    {
        var searchButEnroll = "<input "
            + " id=search-wait-id-"
            + sectHead
            + " class=' wrbutton wrbuttons wrbuttonspew wrbuttonsr secondary search-enroll-class search-wait-class "
            + optAllClass
            + " "
            + optEnWtClass
            + " ' "
            + " type='button' value='Waitlist' />";
    }

    var searchButPlan = "<input "
        + " id=search-plan-id-"
        + sectHead
        + " class=' wrbutton wrbuttons wrbuttonspew secondary search-plan-class "
        + optAllClass
        + " "
        + optPlanClass
        + " ' "
        + " type='button' value='Plan' />";

    return searchButPlan
        + searchButEnroll;

}

function searchReloadGrid(searchGridClose, gridObj, loadData, groupId)
{

    var scrollSave = (window.pageYOffset !== undefined) ? window.pageYOffset : (document.documentElement
        || document.body.parentNode || document.body).scrollTop;
    gridObj.jqGrid("clearGridData", true);
    gridObj.jqGrid('setGridParam', {
        datatype : 'local', data : loadData
    }).trigger("reloadGrid");

    var sortCol = sGridObj.getGridParam("colModel")[0];
    if (searchFromTop)
    {
        sortCol.sorttype = searchSortFunc;
    }
    else
    {
        sortCol.sorttype = "text"; // restore
    }

    if (searchGridClose)
    {
        openGroupIds = [];
        openGroupIds.length = 0;
    }
    else
    {
        $.each(openGroupIds, function(i, entry)
        {
            gridObj.jqGrid('groupingToggle', entry);
        });
    }

    // add but not toggle because it is already opened
    if (undefined != groupId)
    {
        openGroupIds.push(groupId);
    }

    $("#search-div-b-table tr.jqgroup").hover(function(e)
    {
        $(e.target).closest("tr.jqgroup").addClass("search-group-mouseover");
    }, function(e)
    {
        $(e.target).closest("tr.jqgroup").removeClass("search-group-mouseover");
    });

    $(".search-pbf-class").hide();

    window.scrollTo(0, scrollSave);

}

function searchPlanButFun(enrollUnitObj)
{
    var sectionHead = enrollUnitObj.sectionHead;
}

function searchEnrollButFun(enrollUnitObj)
{
    var sectionHead = enrollUnitObj.sectionHead;
}

function searchSectNumAttr(rowId, cellVal, rawObject, cm)
{

    var cspan = rawObject.COL_SPAN;
    var cspan_str = ' colspan=1';
    if (cspan > 0)
    {
        cspan_str = ' colspan="'
            + cspan
            + '"';
    }

    var rspan = rawObject.ROW_SPAN;
    var rspan_str = ' rowspan=1';
    if (0 == rspan)
    {
        rspan_str = ' style="display:none" ';
    }
    else if (rspan > 0)
    {
        rspan_str = ' rowspan="'
            + rspan
            + '"';
    }

    if (rawObject.LONG_DESC != undefined
        && rawObject.LONG_DESC.trim() != "")
    {   
    	if(cellVal.toUpperCase().indexOf("styles".toUpperCase()) != -1){
    		
    		var index = cellVal.toUpperCase().indexOf("styles".toUpperCase());
    		var replacedChar = 'è';
    		cellVal = cellVal.substr(0, index+4) + replacedChar + cellVal.substr(index+5);
    	}
    	else if(cellVal.toUpperCase().indexOf("style".toUpperCase()) != -1 && !cellVal.includes("span")){
    		
    		var index = cellVal.toUpperCase().indexOf("style".toUpperCase());
    		var replacedChar = 'è';
    		cellVal = cellVal.substr(0, index+4) + replacedChar + cellVal.substr(index+5);    	
    		
    	}
    	
        rspan_str += ' title="'
            + cellVal
            + '" ';
        
        
        
        //
        
    }
    var spanObj  = cspan_str
    + ' '
    + rspan_str;  
    
    
    return spanObj;

}
;

function searchSectCodeAttr(rowId, cellVal, rawObject, cm)
{
    var cspan = rawObject.COL_SPAN_SC;
    if (undefined == cspan
        || "" == cspan
        || null == cspan)
    {
        cspan = 1;
    }
    return ' colspan="'
        + cspan
        + '"';
}
;

function searchDaysAttr(rowId, cellVal, rawObject, cm)
{
    var cspan = rawObject.COL_SPAN_DAYS;
    if (undefined == cspan
        || "" == cspan
        || null == cspan)
    {
        cspan = 1;
    }

    var rspan = rawObject.ROW_SPAN_DAYS;
    if (undefined == rspan
        || "" == rspan
        || null == rspan)
    {
        rspan = 1;
    }

    return ' colspan="'
        + cspan
        + '" rowspan="'
        + rspan
        + '"';
}
;

function searchActionAttr(rowId, cellVal, rawObject, cm)
{
    var rspan = rawObject.ROW_SPAN;
    if (undefined == rspan
        || "" == rspan
        || null == rspan)
    {
        rspan = 1;
    }
    else if (0 == rspan)
    {
        return ' style="display:none" ';
    }
    return ' rowspan="'
        + rspan
        + '"';
}
;

function searchInstAttr(rowId, cellVal, rawObject, cm)
{
    var rspan = rawObject.ROW_SPAN_INST;
    if (undefined == rspan
        || "" == rspan
        || null == rspan)
    {
        rspan = 1;
    }
    return ' rowspan="'
        + rspan
        + '" ';
}
;

function hideGridAll()
{
    $('#search-grid-toggle').hide();
    $("#search-pager-dropdown").hide();
    $("#search-pager-dropdown-header").hide();
    $("#search-div-b-table").hide();
    $('#search-grid-result').hide();
    $("#search-div-b").hide();
}

function initGridAll()
{
    $('#search-grid-toggle').show();
    $("#search-pager-dropdown").hide();
    $("#search-pager-dropdown-header").hide();
    $("#search-div-b-table").show();
    $('#search-grid-result').show();
    $("#search-div-b").show();

    $("#search-pager").empty();
    $("#search-pager").show();
    $('#search-grid-toggle').text("Hide search result");
    searchGlobalInitialize();

}

function searchDisableAllForSID()
{
    $("#search-div-box-1 input.search-div-binput-canoff").prop('disabled', true);
    $("#search-div-box-2 input").prop('disabled', true);
    $("#search-div-t-t2-i1").select2('disable');
    $("#search-div-t-t3-i1").select2('disable');
    $('#search-div-t-t5 select.ui-timepicker-select').prop('disabled', true);

    // add class to labels on right side to make them look more disabled
    $(".search-not-section").addClass("search-right-side-hide");
}

function searchEnableAllForSID()
{
    $("#search-div-box-1 input.search-div-binput-canoff").prop('disabled', false);
    $("#search-div-box-2 input").prop('disabled', false);
    $("#search-div-t-t2-i1").select2('enable');
    $("#search-div-t-t3-i1").select2('enable');
    $('#search-div-t-t5 select.ui-timepicker-select').prop('disabled', false);

    // remove class that makes the right side labels look disabled
    $(".search-not-section").removeClass("search-right-side-hide");
}

function searchLoadSubject()
{

    $("#search-div-t-t2-i1").select2('val', '');

    if (selectBottomInitSubj)
    {
        return;
    }

    // select2 subj
    var lastReDataSubj = undefined;
    $("#search-div-t-t2-i1").empty();
    $("#search-div-t-t2-i1").select2(
        {
            multiple : true,
            containerCssClass : "wr-select-other wr-select-other-subj",
            dropdownCssClass : "wr-select-other-drop",
            placeholder : "Select one or more",
            allowClear : true,
            closeOnSelect : false

            ,
            query : function(query)
            {
                var inputAll = query.term
                var reData = {
                    results : []
                };
                var reTerm = new RegExp(inputAll.trim(), 'i');

                if ("" === inputAll)
                {
                    if (undefined != lastReDataSubj)
                    {
                        reData.results = lastReDataSubj;
                    }
                }
                else
                {
                    var tmpList = [];
                    tmpList.length = 0;
                    var reTmpSubjCode = new RegExp("^\\s*"
                        + inputAll.trim(), "i");
                    var reTmpSubjText = new RegExp(inputAll.trim(), "i");
                    $.each(subjDataSel, function(i, entry)
                    {
                        if (undefined != entry.subjcode
                            && entry.subjcode.match(reTmpSubjCode))
                        {
                            reData.results.push({
                                id : i, text : entry.text, subjcode : entry.subjcode
                            });
                        }
                        else if (undefined != entry.text
                            && entry.text.match(reTmpSubjText))
                        {
                            tmpList.push({
                                id : i, text : entry.text, subjcode : entry.subjcode
                            });
                        }
                    });
                    if (tmpList.length > 0)
                    {
                        reData.results = reData.results.concat(tmpList);
                    }
                    tmpList = [];
                    tmpList.length = 0; // release
                    lastReDataSubj = $.extend(true, [], reData.results);
                }
                query.callback(reData);
            }
        });
    $("#search-div-t-t2-i1").on('select2-opening', function()
    {
        selectBottomInitSubj = true;
        lastReDataSubj = subjDataSel;
    });
}

// department load
function searchLoadDepartment()
{

    $("#search-div-t-t3-i1").select2('val', '');

    if (selectBottomInitDep)
    {
        return;
    }

    if (null == gDepData
        || (null != gDepData && 0 == gDepData.length))
    {
        wrapperSearchLoadDepartment(function(data)
        {
            gDepData = data;
        });
    }

    if (0 == depDataSel.length)
    {
        $.each(gDepData, function(index, entry)
        {
            var depCode = entry.DEP_CODE;
            var depDesc = entry.DEP_DESC;
            var depText = depCode
                + ' / '
                + depDesc;
            depDataSel.push({
                id : index, text : depText, depcode : depCode, depdesc : depDesc
            });
        });
    }

    // select2 dep
    var lastReDataDep = undefined;
    $("#search-div-t-t3-i1").empty();
    $("#search-div-t-t3-i1").select2(
        {
            multiple : true,
            containerCssClass : "wr-select-other wr-select-other-dep",
            dropdownCssClass : "wr-select-other-drop",
            placeholder : "Select one or more",
            allowClear : true,
            closeOnSelect : false

            ,
            query : function(query)
            {
                var inputAll = query.term
                var reData = {
                    results : []
                }

                // trim() important due to backspace
                var reTerm = new RegExp(inputAll.trim(), 'i');

                if ("" === inputAll)
                {
                    if (undefined != lastReDataDep)
                    {
                        reData.results = lastReDataDep;
                    }

                }
                else
                {
                    var tmpList = [];
                    tmpList.length = 0;
                    var reTmpDepCode = new RegExp("^\\s*"
                        + inputAll.trim(), "i");
                    var reTmpDepText = new RegExp(inputAll.trim(), "i");

                    $.each(depDataSel, function(i, entry)
                    {
                        if (undefined != entry.depcode
                            && entry.depcode.match(reTmpDepCode))
                        {
                            reData.results.push({
                                id : i, text : entry.text, depcode : entry.depcode
                            });

                        }
                        else if (undefined != entry.text
                            && entry.text.match(reTmpDepText))
                        {
                            tmpList.push({
                                id : i, text : entry.text, depcode : entry.depcode
                            });
                        }
                    });
                    if (tmpList.length > 0)
                    {
                        reData.results = reData.results.concat(tmpList);
                    }
                    tmpList = [];
                    tmpList.length = 0; // release
                    lastReDataDep = $.extend(true, [], reData.results);

                }
                query.callback(reData);
            }
        });
    $("#search-div-t-t3-i1").on('select2-opening', function()
    {
        selectBottomInitDep = true;
        lastReDataDep = depDataSel;
    });
}

function classSearchFun(pSubjCode, pCrseCode, pSectNum)
{

    // direct call
    if (undefined != pSectNum)
    {
        searchOpenGrid();
        searchBottomFun(undefined, undefined, pSectNum, false, true);
        return;
    }
    else if (undefined != pSubjCode
        && undefined != pCrseCode)
    {
        searchOpenGrid();
        searchBottomFun(pSubjCode, pCrseCode, undefined, false, true);
        return;
    }

    if ($('#advanced-search').text().match(/hide/i))
    {
        $('#advanced-search').text("Advanced search");
        $("#search-div-1").hide();
        $("#search-div-t-t1-i1-td").show();
        $("#search-div-t-t1-button-div").show();
        searchEnableAllForSID();
        return;
    }

    $("#search-div-t-t1-i1-td").hide();
    $("#search-div-t-t1-button-div").hide();
    $("#search-div-1").show();
    $('#advanced-search').text("Hide advanced search");

    // secdtion ID disabler
    $("#search-div-t-t3-i4").val('');

    searchEnableAllForSID();

    $("#search-div-t-t3-i4").on("keyup cut paste drop", function(e)
    {
        var sidVal = undefined;
        if ('paste' == e.type
            || 'cut' == e.type
            || 'drop' == e.type)
        {
            setTimeout(function()
            {
                sidVal = $("#search-div-t-t3-i4").val();
                if (sidVal)
                {
                    if (!$("#search-div-t-t2-i2").prop('disabled'))
                    {
                        searchDisableAllForSID();
                    }
                }
                else
                {
                    searchEnableAllForSID();
                    return;
                }
            }, 100);
        }
        else
        {
            sidVal = $("#search-div-t-t3-i4").val();
            if (sidVal)
            {
                if (!$("#search-div-t-t2-i2").prop('disabled'))
                {
                    searchDisableAllForSID();
                }
            }
            else
            {
                searchEnableAllForSID();
                return;
            }
        }
    });

    // time
    $('#search-div-t-t5-i1').timepicker(tpOptions);
    $('#search-div-t-t5-i2').timepicker(tpOptions);
    $('#search-div-t-t5 tbody tr td select.ui-timepicker-select').val(''); // for
    // nonOption

    // subj
    searchLoadSubject();

    // dep
    searchLoadDepartment();

    // important
    $("#search-div-t-t2-i1").select2('val', '');
    $("#search-div-t-t3-i1").select2('val', '');

    $('#search-div-t-b2').click(function()
    {
        initGridAll();
        searchOpenGrid();
        searchBottomFun();
    });

    $("#search-div-t-reset").click(function()
    {
        $("#search-div-t-t2-i1").select2('val', '');
        $("#search-div-t-t3-i1").select2('val', '');
        $(".search-div-binput").val('');
        $('#search-div-t-t5 tbody tr td select.ui-timepicker-select').val('');
        $(".search-div-bcheck").prop('checked', false);
        searchEnableAllForSID();
        hideGridAll();
    });

    $(".search-div-binput").keypress(function(e)
    {
        if (e.which == 13
            && $(this).val())
        {
            e.preventDefault();
            $('#search-div-t-b2').trigger('click');
            return false;
        }
    });

    // focus
    $(".search-div-binput").focus(function()
    {
        $(this).select();
    });

}

function searchOpenGrid()
{

    if (sGridObj[0].grid)
    {
        // grid is initialized
        return;
    }

    $('#search-grid-toggle').show();

    $('#search-grid-toggle').click(function()
    {
        if ($('#search-grid-toggle').text().match(/hide/i))
        {
            $('#search-grid-result').hide();
            $('#search-grid-toggle').text("Show search result");
        }
        else
        {
            $('#search-grid-result').show();
            $('#search-grid-toggle').text("Hide search result");
        }
    });

    sGridObj.jqGrid({
        data : sLocalData,
        datatype : 'local',
        hidegrid : true,
        autowidth : true,
        height : '100%',
        shrinkToFit : true,
        scrollOffset : 0,

        // datatype must be "local" to be fired
        loadComplete : function()
        {

            $(".search-group-header-noseat").parent().children().css('cursor', 'default');
            $(".search-group-header-noseat").closest("tr.jqgroup").find('td:first-child span').removeClass("ui-icon tree-wrap-ltr ui-icon-circlesmall-plus");

            // focus

            $('#search-div-b-table tr.jqgrow.wr-search-group-data-row').hover(function()
            { // enter
                var rowId = $(this).attr('id');
                var targetRow = undefined;
                var coup = sGridObj.jqGrid('getCell', rowId, 22); // looks
                // weird
                // when this
                // works
                if (1 == coup)
                {
                    targetRow = Number(rowId) + 1;
                }
                else if (2 == coup)
                {
                    targetRow = Number(rowId) - 1;
                }
                if (undefined != targetRow)
                {
                    $('#search-div-b-table tbody tr.jqgrow#'
                        + targetRow).addClass('ui-state-hover');
                }
            }, function()
            { // leave
                var rowId = $(this).attr('id');
                var targetRow = undefined;
                var coup = sGridObj.jqGrid('getCell', rowId, 22);

                if (1 == coup)
                {
                    targetRow = Number(rowId) + 1;
                }
                else if (2 == coup)
                {
                    targetRow = Number(rowId) - 1;
                }
                if (undefined != targetRow)
                {
                    $('#search-div-b-table tbody tr.jqgrow#'
                        + targetRow).removeClass('ui-state-hover');
                }
            });
        },

        /** * sorting and paging *** */
        gridview : true, // load grid at once
        loadonce : true,
        rowNum : 5000,

        // set colModel default
        cmTemplate : {
            title : false
        },

        beforeSelectRow : function(rowid, e)
        {
            return false; // lose focus
        },

        onRightClickRow : function()
        {
            sGridObj.jqGrid('resetSelection');
            return false;
        },

        colNames : [
            'colsubj',
            'SUBJ_CODE',
            'CRSE_CODE',
            'Section ID',
            'Section',
            'Type',
            'Days',
            'Time',
            'Building',
            'Room',
            'Avail Seats',
            'Total Seats',
            'WT POS',
            'Book',
            'Instructor',
            'Action' // 18
            ,
            'SortKey',
            'Span',
            'RowAttr',
            'RowCoup' ],

        // colModel : [
        // { name : 'colsubj', sorttype:'text', index : 'colsubj',
        // align:'center', editable: false, sortable: false }
        // , { name: 'SUBJ_CODE', hidden:true }
        // , { name: 'CRSE_CODE', hidden:true }
        // , { name: 'SECTION_NUMBER', fixed:true, index:'sectnum', width:50,
        // align: 'center', editable: false,
        // sortable: false, cellattr: searchSectNumAttr }
        // , { name: 'SECT_CODE', fixed:true, index:'sectcode', width:40, align:
        // 'center', editable: false, sortable:
        // false, cellattr: searchSectCodeAttr }
        // , { name: 'FK_CDI_INSTR_TYPE', fixed:true, index:'type', width:45,
        // align: 'center', editable: false,
        // sortable: false ,title:true ,cellattr: gridTTInstType }
        // , { name: 'DAY_CODE', fixed:true, index:'days', width:60, align:
        // 'center', editable: false, sortable: false
        // ,cellattr: searchDaysAttr }
        // , { name: 'coltime', fixed:true, index:'time', width:70, align:
        // 'center', editable: false, sortable: false }
        // , { name: 'BLDG_CODE', fixed:true, index:'bld', width:45, align:
        // 'center', editable: false, sortable: false }
        // , { name: 'ROOM_CODE', fixed:true, index:'rm', width:30, align:
        // 'center', editable: false, sortable: false }
        // , { name: 'AVAIL_SEAT', fixed:true, index:'aseat', width:30, align:
        // 'center', editable: false, sortable:
        // false }
        // , { name: 'SCTN_CPCTY_QTY', fixed:true, index:'tseat', width:30,
        // align: 'center', editable: false, sortable:
        // false }
        // , { name: 'COUNT_ON_WAITLIST', fixed:true, index:'cwt', width:40,
        // align: 'center', editable: false, sortable:
        // false }
        // , { name: 'BOOK_LINK', fixed:true, index:'book', width:33, align:
        // 'center', editable: false, sortable: false
        // }
        // , { name: 'PERSON_FULL_NAME', fixed:true, index:'inst', width:292,
        // align: 'center', editable: false,
        // sortable: false, cellattr: searchInstAttr }
        // , { name: 'colaction', fixed:true, index:'action', width:130, align:
        // 'center', editable: false, sortable:
        // false, cellattr: searchActionAttr }
        // , { name: 'SORT_KEY', hidden:true, sorttype:'int' }
        // , { name: 'ROW_SPAN' , hidden:true }
        // , { name: 'ROW_ATTR' , hidden:true }
        // , { name: 'ROW_COUP', hidden:true } //0-no coup, 1-top, 2-bottom
        // ],
        colModel : [ {
            name : 'colsubj', sorttype : 'text', index : 'colsubj', align : 'center', editable : false, sortable : false
        }, {
            name : 'SUBJ_CODE', hidden : true
        }, {
            name : 'CRSE_CODE', hidden : true
        }, {
            name : 'SECTION_NUMBER', fixed : true, index : 'sectnum', width : 50, align : 'center', editable : false, sortable : false, cellattr : searchSectNumAttr
        }, {
            name : 'SECT_CODE', fixed : true, index : 'sectcode', width : 40, align : 'center', editable : false, sortable : false, cellattr : searchSectCodeAttr
        }, {
            name : 'FK_CDI_INSTR_TYPE', fixed : true, index : 'type', width : 45, align : 'center', editable : false, sortable : false, title : true, cellattr : gridTTInstType
        }, {
            name : 'DAY_CODE', fixed : true, index : 'days', width : 60, align : 'center', editable : false, sortable : false, cellattr : searchDaysAttr
        }, {
            name : 'coltime', fixed : true, index : 'time', width : 75, align : 'center', editable : false, sortable : false
        }, {
            name : 'BLDG_CODE', fixed : true, index : 'bld', width : 45, align : 'center', editable : false, sortable : false
        }, {
            name : 'ROOM_CODE', fixed : true, index : 'rm', width : 36, align : 'center', editable : false, sortable : false
        }, {
            name : 'AVAIL_SEAT', fixed : true, index : 'aseat', width : 30, align : 'center', editable : false, sortable : false
        }, {
            name : 'SCTN_CPCTY_QTY', fixed : true, index : 'tseat', width : 30, align : 'center', editable : false, sortable : false
        }, {
            name : 'COUNT_ON_WAITLIST', fixed : true, index : 'cwt', width : 40, align : 'center', editable : false, sortable : false
        }, {
            name : 'BOOK_LINK', fixed : true, index : 'book', width : 33, align : 'center', editable : false, sortable : false
        }, {
            name : 'PERSON_FULL_NAME', fixed : true, index : 'inst', width : 281, align : 'center', editable : false, sortable : false, cellattr : searchInstAttr
        }, {
            name : 'colaction', fixed : true, index : 'action', width : 130, align : 'center', editable : false, sortable : false, cellattr : searchActionAttr
        }, {
            name : 'SORT_KEY', hidden : true, sorttype : 'int'
        }, {
            name : 'ROW_SPAN', hidden : true
        }, {
            name : 'ROW_ATTR', hidden : true
        }, {
            name : 'ROW_COUP', hidden : true
        } // 0-no coup, 1-top, 2-bottom
        ],

        rowattr : function(rd)
        {
            var res = '';
            var attr = rd.ROW_ATTR;

            if (undefined != attr)
            {
                if (undefined != rd.ROW_ATTR.rowClass)
                {
                    res = {
                        "class" : rd.ROW_ATTR.rowClass
                    };
                }
            }
            return res;
        },

        caption : "Search results and action",
        sortname : 'SORT_KEY',
        sortorder : 'asc',

        // grouping
        grouping : true,
        groupingView : {
            // missing gorupFiled causes grtypes[gin] is undefined
            groupField : [ 'colsubj' ], groupCollapse : true, groupColumnShow : [ false ]
        }

    });

    // title grid header
    $('#jqgh_search-div-b-table_GRADE_OPTION').attr('title', 'Grade Option');

}

// plan ----------------------------------------------------------
$("#dialog-plan").dialog({
    // title : 'Plan Class',
    autoOpen : false, maxWidth : 1050, position : {
        my : "center", at : "center", of : window
    }, height : 'auto', width : 1050, modal : true, closeOnEscape : false, buttons : {

        Cancel : {
            text : "Cancel", click : function()
            {
                $(this).dialog("close");
            }
        }, Confirm : {
            text : "Confirm", click : function()
            {
                $(this).dialog("close");
                var gradeVal = $('#diagplan-class-table-grade option:selected').val();
                var unitVal = $('#diagplan-class-table-unit option:selected').text();

                if (undefined == gradeVal
                    || gradeVal.trim() == '')
                {
                    gradeVal = gradeOptionDeConv($('#diagplan-class-table-grade-p').text());
                }

                if (undefined == unitVal
                    || unitVal.trim() == '')
                {
                    unitVal = $('#diagplan-class-table-unit-p').text();
                }

                var subjCrse = $(this).dialog('option', 'subjcrse');
                var subjCode = $(this).dialog('option', 'subjcode');
                var crseCode = formatCrseCode($(this).dialog('option', 'crsecode'));
                var stitle = $(this).dialog('option', 'stitle');
                var sectionHead = $(this).dialog('option', 'sectionhead');
                var sectCode = $(this).dialog('option', 'sectcode');
                unitVal = Number(unitVal).toFixed(2);

                wrapperPlanAdd(schedCur, subjCode, crseCode, sectionHead, sectCode, gradeVal, unitVal, function(data)
                {

                    var tipMsg = "";

                    if ('SUCCESS' == data.OPS)
                    {
                        rebuildTabs();
                        updatePreAuthLinks();

                        tipMsg = "<div class='msg confirm'><h4>Request Successful</h4><span>Planned "
                            + subjCrse.trim()
                            + " with "
                            + gradeOptionConv(gradeVal)
                            + " grade option for "
                            + unitVal
                            + " units, Section "
                            + sectionHead
                            + ".</span></div>";

                        // conflict message
                        tipMsg += checkAllEditConflictsAndGetMsg(sectionHead, true);

                        $("#search-plan-id-"
                            + sectionHead).button().button('disable');
                        $("#search-plan-id-"
                            + sectionHead).attr('title', 'Already planned');

                        if (sGridObj[0].grid)
                        {
                            if (undefined != sLocalDataCurrentPage)
                            {
                                sLocalDataLoaded[sLocalDataCurrentPage] = $.extend(true, [], sLocalData);
                                var jobDone = false;

                                var reSectionHead = new RegExp(sectionHead);
                                $.each(sLocalDataLoaded, function(i, thisPage)
                                {
                                    if (jobDone) return false;
                                    if (undefined == thisPage
                                        || 0 == thisPage.length)
                                    {
                                        return;
                                    }

                                    $.each(thisPage, function(j, thisRow)
                                    {
                                        if (undefined != thisRow.SECTION_NUMBER
                                            && thisRow.SECTION_NUMBER.toString().match(reSectionHead))
                                        {
                                            if (undefined != thisRow.colaction
                                                && !thisRow.colaction.match(/^\s*$/))
                                            {
                                                thisRow.colaction = thisRow.colaction.replace(/disableSBSectionClass/g, "");
                                                thisRow.colaction = thisRow.colaction.replace(/wrbuttonspew/g, "wrbuttonspew disableSBSectionClass ");
                                                jobDone = true;
                                                return false;
                                            }
                                        }
                                    });
                                });

                                searchLoadGridPage(sLocalDataCurrentPage, false, false);
                            }
                        }

                    }
                    else
                    {
                        var reason = "";
                        if (undefined != data.REASON
                            || "null" != data.REASON)
                        {
                            reason = data.REASON;
                        }
                        tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Attempting to plan "
                            + subjCrse.trim()
                            + ", Section "
                            + sectionHead
                            + ".  "
                            + reason
                            + "</span></div>";

                    }
                    var $tmpDiag = $("#dialog-after-action").dialog('open');

                    var tmpArr = dialogAfterActionBut.slice(0);
                    tmpArr.splice(1, 2);
                    $tmpDiag.dialog('option', 'buttons', tmpArr);
                    updateTips(tipMsg);
                });

                return;
            }
        }

    }
});

$("#dialog-confirm-plan-remove").dialog({
    autoOpen : false, maxWidth : 1050, position : {
        my : "center", at : "center", of : window
    }, height : 'auto', width : 1050, modal : true, closeOnEscape : false, buttons : {
        but1 : {
            text : 'Cancel', click : function()
            {
                $(this).dialog("close");
                return;
            }
        }, but2 : {
            text : 'Remove', click : function()
            {
                $(this).dialog("close");
                var sectionHead = $(this).dialog('option', 'sectionhead');
                var subjCode = $(this).dialog('option', 'subjcode');
                var crseCode = formatCrseCode($(this).dialog('option', 'crsecode'));
                var stitle = $(this).dialog('option', 'stitle');

                var subjCodeTrim = subjCode.toString().trim();
                var crseCodeTrim = crseCode.toString().trim();

                wrapperPlanRemove(schedCur, sectionHead, function(data)
                {
                    var tipMsg = "";

                    if ('SUCCESS' == data.OPS)
                    {
                        rebuildTabs();
                        updatePreAuthLinks();

                        tipMsg = "<div class='msg confirm'><h4>Request Successful</h4><span>Removed planned class "
                            + subjCode.trim()
                            + " "
                            + crseCode.trim()
                            + " "
                            + stitle.trim()
                            + ", Section "
                            + sectionHead
                            + ".</span></div>";

                        if (sGridObj[0].grid)
                        {
                            if (undefined != sLocalDataCurrentPage)
                            {
                                sLocalDataLoaded[sLocalDataCurrentPage] = $.extend(true, [], sLocalData);
                                var jobDone = false;
                                var reSectionHead = new RegExp(sectionHead);
                                $.each(sLocalDataLoaded, function(i, thisPage)
                                {
                                    if (jobDone) return false;
                                    if (undefined == thisPage
                                        || 0 == thisPage.length)
                                    {
                                        return;
                                    }
                                    $.each(thisPage, function(j, thisRow)
                                    {
                                        if (undefined != thisRow.SECTION_NUMBER
                                            && thisRow.SECTION_NUMBER.toString().match(reSectionHead))
                                        {

                                            if (undefined != thisRow.colaction
                                                && !thisRow.colaction.match(/^\s*$/))
                                            {
                                                thisRow.colaction = thisRow.colaction.replace(/disableSBSectionClass/g, ' ');
                                                jobDone = true;
                                                return false;
                                            }
                                        }
                                    });
                                });
                                searchLoadGridPage(sLocalDataCurrentPage, false, false);
                            }
                        }

                    }
                    else
                    {
                        var reason = "";
                        if (undefined != data.REASON
                            || "null" != data.REASON)
                        {
                            reason = data.REASON;
                        }
                        tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Attempting to remove Planned class - "
                            + subjCode.trim()
                            + " "
                            + crseCode.trim()
                            + " "
                            + stitle.trim()
                            + ", Section "
                            + sectionHead
                            + ".  "
                            + reason
                            + "</span></div>";
                    }
                    var $tmpDiag = $("#dialog-after-action").dialog('open');

                    var tmpArr = dialogAfterActionBut.slice(0);
                    tmpArr.splice(1, 2); // no email = No actionevent
                    $tmpDiag.dialog('option', 'buttons', tmpArr);
                    updateTips(tipMsg);
                });

                return;
            }
        }
    }
});

$("#dialog-confirm-plan-add").dialog({
    autoOpen : false, maxWidth : 800, position : {
        my : "center", at : "center", of : window
    }, height : 'auto', width : 800, modal : true, closeOnEscape : false, buttons : {
        but1 : {
            text : 'Cancel', click : function()
            {
                $(this).dialog("close");
                return;
            }
        }, but2 : {
            text : 'Confirm', click : function()
            {
                $(this).dialog("close");
                var sectionHead = $(this).dialog('option', 'sectionhead');
                var subjCode = $(this).dialog('option', 'subjcode');
                var crseCode = formatCrseCode($(this).dialog('option', 'crsecode'));
                var stitle = $(this).dialog('option', 'stitle');

                var subjCodeTrim = subjCode.toString().trim();
                var crseCodeTrim = crseCode.toString().trim();

                var sectCode = $(this).dialog('option', 'sectcode');
                var gradeEnable = $(this).dialog('option', 'gradeenable');
                var unitEnable = $(this).dialog('option', 'unitenable');
                var unitFrom = $(this).dialog('option', 'unitfrom');
                var unitTo = $(this).dialog('option', 'unitto');
                var unitInc = $(this).dialog('option', 'unitinc');
                var gradeDefault = $(this).dialog('option', 'gradedefault');
                var unitDefault = $(this).dialog('option', 'unitdefault');

                classPlanEditFun(sectionHead, sectCode, subjCode, crseCode, stitle, gradeEnable, unitEnable, gradeDefault, unitDefault, unitFrom, unitTo, unitInc, undefined);

                return;
            }
        }
    }
});

function classPlanEditFun(sectionHead, sectCode, subjCode, crseCode, stitle, gradeEnable, unitEnable, gradeDefault, unitDefault, unitFrom, unitTo, unitInc, editWarn)
{

    var aLevel = urlParam2;
    var tmp = stitle.toString().split('(')[0];
    stitle = tmp;

    $("#diagplan-class-table-subj").empty();
    $("#diagplan-class-table-title").empty();
    $("#diagplan-class-table-grade-p").empty();
    $("#diagplan-class-table-unit-p").empty();
    $("#diagplan-class-table-code").empty();
    $("#diagplan-class-table-type").empty();
    $("#diagplan-class-table-days").empty();
    $("#diagplan-class-table-time").empty();

    $(".diagplan-class-table-no1234").remove();

    var crseCodeTmp = formatCrseCode(crseCode);
    var subjCrse = subjCode
        + " "
        + crseCode;

    var $diagObj = $('#dialog-plan').dialog('open');
    $diagObj.dialog('option', 'sectionhead', sectionHead);
    $diagObj.dialog('option', 'sectcode', sectCode);
    $diagObj.dialog('option', 'subjcrse', subjCrse);
    $diagObj.dialog('option', 'subjcode', subjCode);
    $diagObj.dialog('option', 'crsecode', crseCode);
    $diagObj.dialog('option', 'stitle', stitle);
    $('#diagplan-class-table-subj').text(subjCrse);
    $('#diagplan-class-table-title').text(stitle);

    // get values from search grid
    var count = 0;
    var rows = $(".wr-search-group-data-row").filter(function()
    {
        return $(this).children("td[aria-describedby='search-div-b-table_SECTION_NUMBER']").text().indexOf(sectionHead) != -1;
    });

    // add subtitle to course title if it exists
    var subtitle = "";
    if (isIE8)
    {
        subtitle = $('#'
            + rows[0].id).children("td[aria-describedby='search-div-b-table_SECTION_NUMBER']")[0].innerHTML.trim();
    }
    else
    {
        subtitle = $('#'
            + rows[0].id).children("td[aria-describedby='search-div-b-table_SECTION_NUMBER']")[0].textContent.trim();
    }
    subtitle = subtitle.replace(/^\d+/, '');
    if (subtitle.trim() != "")
    {
        subtitle = stitle
            + " - "
            + subtitle.trim();
        $('#diagplan-class-table-title').text(subtitle);
    }

    rows.sort(function(a, b)
    {
        return a.id > b.id;
    });
    var groupData = [];

    $.each(rows, function(index, entry)
    {
        var sectionCode = "";
        var instType = "";
        var dayCode = "";
        var time = "";
        if (isIE8)
        {
            sectionCode = $("#"
                + entry.id).children("td[aria-describedby='search-div-b-table_SECT_CODE']")[0].innerHTML.trim();
            instType = $("#"
                + entry.id).children("td[aria-describedby='search-div-b-table_FK_CDI_INSTR_TYPE']")[0].innerHTML.trim();
            dayCode = $("#"
                + entry.id).children("td[aria-describedby='search-div-b-table_DAY_CODE']")[0].innerHTML.trim();
            time = $("#"
                + entry.id).children("td[aria-describedby='search-div-b-table_coltime']")[0].innerHTML.trim();
        }
        else
        {
            sectionCode = $("#"
                + entry.id).children("td[aria-describedby='search-div-b-table_SECT_CODE']")[0].textContent.trim();
            instType = $("#"
                + entry.id).children("td[aria-describedby='search-div-b-table_FK_CDI_INSTR_TYPE']")[0].textContent.trim();
            dayCode = $("#"
                + entry.id).children("td[aria-describedby='search-div-b-table_DAY_CODE']")[0].textContent.trim();
            time = $("#"
                + entry.id).children("td[aria-describedby='search-div-b-table_coltime']")[0].textContent.trim();
        }

        // var sectionCode =
        // $("#"+entry.id).children("td[aria-describedby='search-div-b-table_SECT_CODE']")[0].textContent.trim();
        // var instType =
        // $("#"+entry.id).children("td[aria-describedby='search-div-b-table_FK_CDI_INSTR_TYPE']")[0].textContent.trim();
        // var dayCode =
        // $("#"+entry.id).children("td[aria-describedby='search-div-b-table_DAY_CODE']")[0].textContent.trim();
        // var time =
        // $("#"+entry.id).children("td[aria-describedby='search-div-b-table_coltime']")[0].textContent.trim();
        if (instType != "")
        {
            if (count == 0)
            {
                $('#diagplan-class-table-code').text(sectionCode);
                $('#diagplan-class-table-type').text(gradeOptionConv(instType));
                $('#diagplan-class-table-days').text(dayCode);
                $('#diagplan-class-table-time').text(time);
            }
            else
            {
                var table = $("#diagplan-class-table");
                table.append("<tr class='diagplan-class-table-no1234'>"
                    + "<td class='diagclass-class-table-empty'></td>"
                    + "<td class='diagclass-class-table-empty'></td>"
                    + "<td class='diagclass-class-table-empty'></td>"
                    + "<td class='diagclass-class-table-empty'></td>"
                    + "<td>"
                    + sectionCode
                    + "</td>"
                    + "<td>"
                    + gradeOptionConv(instType)
                    + "</td>"
                    + "<td>"
                    + dayCode
                    + "</td>"
                    + "<td>"
                    + time
                    + "</td>"
                    + "</tr>");
            }
            count++;
        }
    });

    // grade --------------------------
    var gradeP = $('#diagplan-class-table-grade-p');

    gradeP.empty();
    if (gradeEnable)
    {
        gradeP.append("<select class='diagxxx-class-table-td-select' id='diagplan-class-table-grade'></select>");
        var gradeSelect = $('#diagplan-class-table-grade');
        gradeSelect.empty();
        if (aLevel == 'UN')
        {
            gradeSelect.append($('<option></option>').val('L').html('Letter'));
            gradeSelect.append($('<option></option>').val('P').html('Pass / No Pass'));
        }
        else if (aLevel == 'GR')
        {
            gradeSelect.append($('<option></option>').val('L').html('Letter'));
            gradeSelect.append($('<option></option>').val('S').html('Satisfactory / Unsatisfactory'));
        }
        else if (aLevel == 'PH')
        {
            wrapperGetAcademicLevelForCourse(subjCode, crseCode, function(data)
            {
                if (data.ACADEMIC_LEVEL == 'GR')
                {
                    gradeSelect.append($('<option></option>').val('L').html('Letter'));
                }
                else
                {
                    gradeSelect.append($('<option></option>').val('H').html('Honors Pass / Fail'));
                }
                gradeSelect.append($('<option></option>').val('S').html('Satisfactory / Unsatisfactory'));
            });
        }

        if (undefined != gradeDefault)
        {
            gradeSelect.val(gradeDefault);
        }

    }
    else
    {
        if (undefined != gradeDefault)
        {
            gradeP.text(gradeOptionConv(gradeDefault));
        }
        else
        {
            if (aLevel == 'UN')
            {
                gradeP.text('Pass / No Pass');
            }
            else if (aLevel == 'GR')
            {
                gradeP.text('Satisfactory / Unsatisfactory');
            }
            else if (aLevel == 'PH')
            {
                gradeP.text('Satisfactory / Unsatisfactory');
            }
        }
    }

    // units ----------------
    // unitDefault='6' ; unitTo=12 ; unitFrom=1 ; unitInc=1 ; unitEnable = true;
    var unitP = $('#diagplan-class-table-unit-p');
    unitP.empty();
    if (unitEnable
        && undefined != unitFrom
        && undefined != unitTo
        && undefined != unitInc)
    {
        unitP.append("<select class='diagxxx-class-table-td-select' id='diagplan-class-table-unit' ></select>");
        var unitSelect = $('#diagplan-class-table-unit');
        unitSelect.empty();
        var retObj = getUnitSelectVal(unitFrom, unitTo, unitInc, unitDefault);
        $.each(retObj.ob2, function(key, val)
        {
            unitSelect.append($('<option></option>').val(key).html(val));
        });
        unitSelect.val(retObj.ob1);
    }
    else
    {
        unitP.text(unitDefault);
    }

    var tipMsg = "<b>Confirm class, and/or grading option or units to add this class to your plan</b><br><br />";
    if (undefined != editWarn
        && !editWarn.toString().match(/^\s*$/))
    {
        tipMsg = tipMsg
            + "<div class='msg alert'><h4>Alert: </h4>"
            + editWarn
            + "</div>";
    }
    // conflict message
    tipMsg += checkAllEditConflictsAndGetMsg(sectionHead, true);

    updateTips(tipMsg);
}
;

/*
 * Checks for conflicts between all enrolled/waitlisted/planned sections and
 * another section
 */
function checkAllEditConflictsAndGetMsg(sectionNumber, fromSearch)
{
    var retMsg = "";
    var relevantData = [];
    var finalData = [];
    if (fromSearch)
    {

        getRelevantSearchData(sectionNumber, relevantData, finalData);
    }
    else
    {
        getRelevantGridData(sectionNumber, relevantData, finalData);
    }
    checkForEditConflicts(relevantData);
    checkForFinalEditConflicts(finalData);

    if (dialogConflictArray.length > 0
        || dialogFinalConflictArray.length > 0)
    {

        retMsg = getDialogConflictMessage();
    }
    return retMsg;
}

/*
 * Gets message to be displayed on dialogs for conflicts.
 */
function getDialogConflictMessage()
{
    var header = (dialogConflictArray.length
        + dialogFinalConflictArray == 1) ? alertTextSingle : alertTextMulti;
    var retMsg = "<div class='msg alert'><h4>Warning: "
        + header
        + "</h4><ul>";

    $.each(dialogConflictArray, function(index, entry)
    {
        retMsg += "<li>"
            + entry[0].SUBJ_CODE.trim()
            + " "
            + entry[0].CRSE_CODE.trim()
            + ((entry[0].FK_CDI_INSTR_TYPE == 'MI') ? " Midterm" : "")
            + " and "
            + entry[1].SUBJ_CODE.trim()
            + " "
            + entry[1].CRSE_CODE.trim()
            + ((entry[1].FK_CDI_INSTR_TYPE == 'MI') ? " Midterm" : "")
            + "</li>";
    });
    $.each(dialogFinalConflictArray, function(index, entry)
    {
        retMsg += "<li>"
            + entry[0].SUBJ_CODE.trim()
            + " "
            + entry[0].CRSE_CODE.trim()
            + " Final and "
            + entry[1].SUBJ_CODE.trim()
            + " "
            + entry[1].CRSE_CODE.trim()
            + " Final</li>";
    });
    retMsg += "</ul>";
    retMsg += "This section's time conflicts with another course on your schedule. Your add request has processed, but you must resolve this time conflict by dropping one of these courses. You are responsible for resolving time conflicts, which may also include conflicts in the midterm or final exam schedule.</div>";
    return retMsg;
}

function newRelevantData(entry, dayCodeIndex)
{
    var dayCode = dayCodeIndex || 0;
    var type = (entry.FK_SPM_SPCL_MTG_CD.match(/MI|FI/)) ? entry.FK_SPM_SPCL_MTG_CD : entry.FK_CDI_INSTR_TYPE;
    return {
        DAY_CODE : entry.DAY_CODE_NUM.charAt(dayCode),
        BEGIN_HH_TIME : entry.BEGIN_HH_TIME,
        BEGIN_MM_TIME : entry.BEGIN_MM_TIME,
        END_HH_TIME : entry.END_HH_TIME,
        END_MM_TIME : entry.END_MM_TIME,
        FK_CDI_INSTR_TYPE : type,
        START_DATE : entry.START_DATE,
        END_DATE : entry.SECTION_END_DATE,
        SECTION_NUMBER : entry.ORG_SECTION_NUMBER,
        SUBJ_CODE : entry.SUBJ_CODE,
        CRSE_CODE : entry.CRSE_CODE
    };
}

function getRelevantGridData(sectionNumber, relevantData, finalData)
{

    var confData = getCopyData(cGlobData);
    $.each(confData, function(i, entry)
    {

        if (entry.SECTION_HEAD == sectionNumber)
        {

            // exclude PB_FRIEND except MI and FI
            if (entry.PB_FRIEND)
            {
                if (entry.FK_CDI_INSTR_TYPE == 'MI')
                {
                    relevantData.push(entry);
                }
                else if (entry.FK_CDI_INSTR_TYPE == 'FI')
                {
                    finalData.push(entry);
                }
            }
            else
            {
                relevantData.push(entry);
            }
        }
    });
}

function getRelevantSearchData(sectionNumber, relevantData, finalData)
{
    var copyData = getCopyData(sLocalData);
    var otherSection = undefined;

    // get relevant data
    $.each(copyData, function(index, entry)
    {

        if (entry.ORG_SECTION_NUMBER == undefined)
        {
            return;
        }

        // skip all non mandatory meetings
        if (entry.FK_SPM_SPCL_MTG_CD != undefined
            && entry.FK_SPM_SPCL_MTG_CD.match(/FM|PB|RE|OT|MU/))
        {
            return;
        }

        if (entry.ORG_SECTION_NUMBER == sectionNumber)
        {
            if (entry.FK_SPM_SPCL_MTG_CD != undefined
                && entry.FK_SPM_SPCL_MTG_CD.trim() == 'FI')
            {
                // if final keep separately
                finalData.push(newRelevantData(entry));
                return;
            }
            // split up days
            for (var i = 0; i < entry.DAY_CODE_NUM.length; i++)
            {

                relevantData.push(newRelevantData(entry, i));
            }
            return;
        }
        else if (entry.SECTION_NUMBER != undefined
            && entry.SECTION_NUMBER == sectionNumber)
        {
            // associated LE
            otherSection = entry.ORG_SECTION_NUMBER; // set this to get FI
            // and MI
            for (var i = 0; i < entry.DAY_CODE_NUM.length; i++)
            {

                relevantData.push(newRelevantData(entry, i));
            }

            return;
        }

        // if otherSection will be set it should be set before getting to FI or
        // MI
        if (otherSection != undefined)
        {
            if (entry.ORG_SECTION_NUMBER == otherSection)
            {
                // FI or MI
                if (entry.FK_SPM_SPCL_MTG_CD != undefined
                    && entry.FK_SPM_SPCL_MTG_CD.trim() == 'FI')
                {
                    // if final keep separately
                    finalData.push(newRelevantData(entry));
                    return;
                }
                else if (entry.FK_SPM_SPCL_MTG_CD != undefined
                    && entry.FK_SPM_SPCL_MTG_CD.trim() == 'MI')
                {
                    relevantData.push(newRelevantData(entry)); // whole entry
                    // is fine
                    return;
                }
            }
        }

    });
}

function checkForEditConflicts(relevantData)
{
    dialogConflictArray = [];
    dialogConflictArray.length = 0;
    var confData = getCopyData(cGlobData);

    // conflict for sched
    $.each(relevantData, function(i, entry)
    {

        // skip these meeting types
        if (undefined == entry.FK_CDI_INSTR_TYPE
            || entry.FK_CDI_INSTR_TYPE.match(/FI|FM|PB|RE|OT|MU/))
        {
            return;
        }

        var startTime = String("0"
            + entry.BEGIN_HH_TIME).slice(-2)
            + String("0"
                + entry.BEGIN_MM_TIME).slice(-2);
        var endTime = String("0"
            + entry.END_HH_TIME).slice(-2)
            + String("0"
                + entry.END_MM_TIME).slice(-2);
        var dayCode = entry.DAY_CODE;
        var iType = entry.FK_CDI_INSTR_TYPE;

        var startDate = String(entry.START_DATE).replace(/\-/g, "");
        var endDate = String(entry.END_DATE).replace(/\-/g, "");
        // if TBA then skip
        if (startTime.toString().match(/^0+$/)
            || startDate.toString().match(/TBA/i))
        {
            return;
        }

        $.each(confData, function(j, entry2)
        {

            // skip these types
            if (undefined == entry2.FK_CDI_INSTR_TYPE
                || entry2.FK_CDI_INSTR_TYPE.match(/FI|FM|PB|RE|OT|MU/))
            {
                return;
            }

            var startTime2 = String("0"
                + entry2.BEGIN_HH_TIME).slice(-2)
                + String("0"
                    + entry2.BEGIN_MM_TIME).slice(-2);
            var endTime2 = String("0"
                + entry2.END_HH_TIME).slice(-2)
                + String("0"
                    + entry2.END_MM_TIME).slice(-2);
            var dayCode2 = entry2.DAY_CODE;
            var iType2 = entry2.FK_CDI_INSTR_TYPE

            var startDate2 = String(entry2.START_DATE).replace(/\-/g, "");
            var endDate2 = String(entry2.END_DATE).replace(/\-/g, "");

            // if TBA then skip
            if (startTime2.toString().match(/^0+$/)
                || startDate2.toString().match(/TBA/i))
            {
                return;
            }

            // if same section then skip -- handles case of two different
            // sections sharing a lecture so the
            // lectures don't conflict (you won't be able to stay enrolled in
            // both anyway)
            if (entry.SECTION_NUMBER == entry2.SECTION_NUMBER)
            {
                return;
            }

            // skip addition meetings that aren't MI
            if (entry2.PB_FRIEND
                && iType2 != 'MI')
            {
                return;
            }

            // if both are midterms then check for specific date + overlapping
            // time
            if ('MI' == iType
                && 'MI' == iType2)
            {
                if (startDate == startDate2)
                {
                    if (startTime < endTime2
                        && startTime2 < endTime)
                    {
                        // midterm conflict
                        addToEditConflictsArray(entry, entry2);
                        return;
                    }
                }
                return;
            }

            // need to also check if just one is a midterm
            if ('MI' == iType
                || 'MI' == iType2)
            {
                if (dayCode == dayCode2
                    && startTime < endTime2
                    && startTime2 < endTime)
                {
                    addToEditConflictsArray(entry, entry2);
                    return;
                }
            }

            // else check for day + overlapping time
            if (dayCode == dayCode2
                && startTime < endTime2
                && startTime2 < endTime
                && startDate < endDate2
                && startDate2 < endDate)
            {
                addToEditConflictsArray(entry, entry2);
                return;
            }
        });
    });
}

/*
 * Checks for duplicate entry before adding to conflicts.
 */
function addToEditConflictsArray(a, b)
{
    var duplicate = false;
    // if either are midterms then push automatically
    if (a.FK_CDI_INSTR_TYPE == 'MI'
        || b.FK_CDI_INSTR_TYPE == 'MI')
    {

        dialogConflictArray.push([ a, b ]);
        return;
    }
    $.each(dialogConflictArray, function(index, entry)
    {
        // make sure it's not a duplicate
        if (entry[0].SUBJ_CODE == a.SUBJ_CODE
            && entry[0].CRSE_CODE == a.CRSE_CODE
            && entry[0].FK_CDI_INSTR_TYPE != 'MI'
            && entry[1].SUBJ_CODE == b.SUBJ_CODE
            && entry[1].CRSE_CODE == b.CRSE_CODE
            && entry[1].FK_CDI_INSTR_TYPE != 'MI')
        {

            duplicate = true;
            return false;
        }
    });

    if (!duplicate)
    {
        dialogConflictArray.push([ a, b ]);
    }
}

function checkForFinalEditConflicts(finalData)
{
    dialogFinalConflictArray = [];
    dialogFinalConflictArray.length = 0;
    var confData = getCopyData(cGlobData);

    $.each(finalData, function(i, entry)
    {

        // only compare finals
        if (undefined == entry.FK_CDI_INSTR_TYPE
            || entry.FK_CDI_INSTR_TYPE != 'FI')
        {
            return;
        }

        var startTime = String("0"
            + entry.BEGIN_HH_TIME).slice(-2)
            + String("0"
                + entry.BEGIN_MM_TIME).slice(-2);
        var endTime = String("0"
            + entry.END_HH_TIME).slice(-2)
            + String("0"
                + entry.END_MM_TIME).slice(-2);
        var startDate = entry.START_DATE;
        var dayCode = entry.DAY_CODE;

        // if TBA then skip
        if (startTime.toString().match(/^0+$/)
            || startDate.toString().match(/TBA/i))
        {
            return;
        }

        $.each(confData, function(j, entry2)
        {

            // only compare finals
            if (undefined == entry2.FK_CDI_INSTR_TYPE
                || entry2.FK_CDI_INSTR_TYPE != 'FI')
            {
                return;
            }

            var startTime2 = String("0"
                + entry2.BEGIN_HH_TIME).slice(-2)
                + String("0"
                    + entry2.BEGIN_MM_TIME).slice(-2);
            var endTime2 = String("0"
                + entry2.END_HH_TIME).slice(-2)
                + String("0"
                    + entry2.END_MM_TIME).slice(-2);
            var startDate2 = entry2.START_DATE;
            var dayCode2 = entry2.DAY_CODE;
            var iType2 = entry2.FK_CDI_INSTR_TYPE

            // if TBA then skip
            if (startTime2.toString().match(/^0+$/)
                || startDate2.toString().match(/TBA/i))
            {
                return;
            }

            // if same section then skip -- handles case of two different
            // sections sharing a lecture so the
            // finals don't conflict (you won't be able to stay enrolled in both
            // anyway)
            if (entry.SECTION_NUMBER == entry2.SECTION_NUMBER)
            {
                return;
            }

            // else check for day + overlapping time
            if (startDate == startDate2
                && startTime < endTime2
                && startTime2 < endTime)
            {
                dialogFinalConflictArray.push([ entry, entry2 ]);
                return;
            }

        });
    });
}

function classPlanAddFun(sectionHead, sectCode, subjCode, crseCode, stitle)
{

    if (isAlreadyExist(sectionHead, undefined, undefined, 'ALL')[0])
    {
        var tipMsg = "<div class='msg error'><h4>Request Unsuccessful</h4><span>Attempting to plan "
            + subjCode.trim()
            + " "
            + crseCode.trim()
            + ", Section "
            + sectionHead
            + ".<br /><br />You already have this section in your list.</span></div>";

        var $tmpDiag = $("#dialog-after-action").dialog('open');
        var tmpArr = dialogAfterActionBut.slice(0);
        tmpArr.splice(1, 2); // no email = No actionevent
        $tmpDiag.dialog('option', 'buttons', tmpArr);
        $tmpDiag.dialog('option', 'actionevent', tipMsg);
        updateTips(tipMsg);
        return;
    }

    wrapperEditPlan(sectionHead, subjCode, crseCode, function(data)
    {

        var gradeEnable = false;
        var unitEnable = false;
        var unitFrom = undefined;
        var unitTo = undefined;
        var unitInc = undefined;
        var gradeDefault = undefined;
        var unitDefault = undefined;
        var tipMsg = "";

        // expect this even if OPS not SUCCESS
        if ('YES' == data.GRADE)
        {
            gradeEnable = true;
        }
        if ('YES' == data.UNIT)
        {
            unitEnable = true;
            unitFrom = data.UNIT_FROM;
            unitTo = data.UNIT_TO;
            unitInc = data.UNIT_INC;
        }

        // could be undefined
        gradeDefault = data.GRADE_DEFAULT;
        unitDefault = data.UNIT_DEFAULT; // becomes null or undefined

        var editWarn = undefined;

        if ('SUCCESS' == data.OPS)
        {

            if ('YES' == data.WARNING)
            {
                if (undefined != data.REASON
                    || "null" != data.REASON)
                {
                    editWarn = data.REASON;
                }
            }

            classPlanEditFun(sectionHead, sectCode, subjCode, crseCode, stitle, gradeEnable, unitEnable, gradeDefault, unitDefault, unitFrom, unitTo, unitInc, editWarn);

        }
        else
        {

            if (undefined != data.REASON
                || "null" == data.REASON)
            {
                reason = data.REASON;
            }

            if (undefined == unitDefault)
            {
                tipMsg = "<div class='msg error'><h4>Warning</h4><span>Attempting to plan "
                    + subjCode.trim()
                    + " "
                    + crseCode.trim()
                    + ", Section "
                    + sectionHead
                    + ".<br /><br />"
                    + reason
                    + "<br /><br />You cannot plan this class.</span></div>";
                $("#dialog-msg").dialog('open');
                updateTips(tipMsg);

            }
            else
            {
                tipMsg = "<div class='msg alert'><h4>Warning</h4><span>Attempting to plan "
                    + subjCode.trim()
                    + " "
                    + crseCode.trim()
                    + ", Section "
                    + sectionHead
                    + ".<br /><br />"
                    + reason
                    + "</span></div><b>Do you still want to plan this class?</b>";
                var $diagObj = $("#dialog-confirm-plan-add").dialog('open');
                $diagObj.dialog('option', 'sectionhead', sectionHead);
                $diagObj.dialog('option', 'sectcode', sectCode);
                $diagObj.dialog('option', 'subjcode', subjCode);
                $diagObj.dialog('option', 'crsecode', crseCode);
                $diagObj.dialog('option', 'stitle', stitle);
                $diagObj.dialog('option', 'gradeenable', gradeEnable);
                $diagObj.dialog('option', 'unitenable', unitEnable);
                $diagObj.dialog('option', 'unitfrom', unitFrom);
                $diagObj.dialog('option', 'unitto', unitTo);
                $diagObj.dialog('option', 'unitinc', unitInc);
                $diagObj.dialog('option', 'gradedefault', gradeDefault);
                $diagObj.dialog('option', 'unitdefault', unitDefault);
            }

            updateTips(tipMsg);
        }
    });

}

function classPlanRemoveFun(classObj)
{

    var actionTip = classObj.data.actionTip;
    var sectionHead = classObj.data.sectionHead;
    var gradeVal = classObj.data.gradeVal; // can be undefined
    var unitVal = classObj.data.unitVal; // can be undefined
    var isEnroll = classObj.data.isEnroll; // can be undefined

    // class list
    var instType = '';
    var classArr = [];
    var gridObj = $("#list-id-table");
    var ids = gridObj.jqGrid('getDataIDs');

    for (var i = 0; i < ids.length; i++)
    {
        var rowId = ids[i];
        rowData = gridObj.jqGrid('getRowData', rowId);
        if (!rowData.colstatusorg.match(/plan/i)) continue;
        if (undefined != rowData.PB_FRIEND
            && "true" == rowData.PB_FRIEND)
        {
            continue;
        }
        if (rowData.SECTION_HEAD == sectionHead)
        {
            instType = convInstType(rowData.FK_CDI_INSTR_TYPE);
            if (undefined == instType
                || instType.trim() == '')
            {
                instType = rowData.FK_CDI_INSTR_TYPE;
            }
            var msg = {
                key0 : rowData.SUBJ_CODE,
                key1 : rowData.CRSE_CODE,
                key2 : rowData.CRSE_TITLE,
                key3 : rowData.colsubj,
                key4 : instType,
                key5 : rowData.DAY_CODE,
                key6 : rowData.coltime,
                key7 : gradeOptionConv(rowData.GRADE_OPTION),
                key8 : rowData.SECT_CREDIT_HRS,
                key9 : rowData.SECT_CODE

            };
            classArr.push(msg);
        }
    }

    var $diagObj = $("#dialog-confirm-plan-remove").dialog('open');
    $diagObj.dialog('option', 'sectionhead', sectionHead);
    $diagObj.dialog('option', 'subjcode', classArr[0].key0);
    $diagObj.dialog('option', 'crsecode', classArr[0].key1);
    $diagObj.dialog('option', 'stitle', classArr[0].key2);
    $diagObj.dialog('option', 'gradeval', gradeVal);
    $diagObj.dialog('option', 'unitval', unitVal);
    $diagObj.dialog('option', 'isenroll', isEnroll);

    // clear values
    $("#diagplanrm-class-table-subj").empty();
    $("#diagplanrm-class-table-title").empty();
    $("#diagplanrm-class-table-grade-p").empty();
    $("#diagplanrm-class-table-unit-p").empty();
    $("#diagplanrm-class-table-code").empty();
    $("#diagplanrm-class-table-type").empty();
    $("#diagplanrm-class-table-days").empty();
    $("#diagplanrm-class-table-time").empty();

    $(".diagplanrm-class-table-no1234").remove();

    // set first row
    $("#diagplanrm-class-table-subj").text(classArr[0].key3);

    var title = classArr[0].key2.replace("<br>", "");
    $("#diagplanrm-class-table-title").text(title);
    $("#diagplanrm-class-table-grade-p").text(classArr[0].key7);
    $("#diagplanrm-class-table-unit-p").text(classArr[0].key8);
    $("#diagplanrm-class-table-code").text(classArr[0].key9);
    $("#diagplanrm-class-table-type").text(classArr[0].key4);
    $("#diagplanrm-class-table-days").text(classArr[0].key5);
    $("#diagplanrm-class-table-time").text(classArr[0].key6);

    // classinfo for drop - no edit
    var classInfo = $('#diagplanrm-class-table');
    $('.diagplanrm-class-table-extra-row').empty();

    $.each(classArr.slice(1), function(index, entry)
    {

        var rowDef = '<tr class="diagplanrm-class-table-extra-row diagplanrm-class-table-no1234" >';

        classInfo.append(rowDef
            + '<td class="diagclass-class-table-empty"></td>'
            + '<td class="diagclass-class-table-empty"></td>'
            + '<td class="diagclass-class-table-empty"></td>'
            + '<td class="diagclass-class-table-empty"></td>'
            + '<td>'
            + entry.key9
            + '</td>'
            + '<td>'
            + entry.key4
            + '</td>'
            + '<td>'
            + entry.key5
            + '</td>'
            + '<td>'
            + entry.key6
            + '</td>'
            + '</tr>');
    });

    updateTips(actionTip);

}
;

/** TODO: call this method only for second pass * */
showCalGrantMessage();

function showCalGrantMessage()
{
    var isSecondPass = false;
    if (urlParam1 != undefined)
    {
        var isSummerSession = urlParam1.match(/^S1|^S2|^S3|^SU/i) ? true : false;
    }
    // Getting max hours to see if we are in second pass or not
    // if the max hours is greater than 15 then we are in second pass
    ajaxExe({
        url : '/webreg2/svc/wradapter/secure/get-max-hour-pass', dataType : 'json', // we get string
        type : 'GET', async : false, data : {
            "termCode" : urlParam1, "academicLevel" : urlParam2
        }, successF : function(data)
        {
            if (data > 15.0)
            {
                isSecondPass = true;
            }
            return;
        }
    });

    // get cal grant only for non summer sessions and undergraduate students
    // uncomment at the end
    $("#cal-grant-status").hide();
    if (urlParam2 == "UN"
        && !isSummerSession
        && isSecondPass)
    {
        var termYear = "20"
            + urlParam1.substring(2, 4);
        // termYear = termYear - 1;
        /***************************************************************************************************************
         * 1. write an ajax function that queries the new table 2. check if a record exists for the PID and term 3. if
         * record exists, return false and quit the function. 4. if record does not exist, execute #1 (check cal grant)
         **************************************************************************************************************/

        ajaxExe({
            url : '/webreg2/svc/wradapter/secure/get-cal-grant-flag', dataType : 'text', // we get string
            type : 'GET', async : false, data : {
                "termCode" : urlParam1
            }, successF : function(data)
            {
                if (data == ""
                    || data == null)
                {
                    console.log("record is not there "
                        + data);
                    checkCalGrant();
                }
                return false;
            }
        });

        /** #1 * */
        function checkCalGrant()
        {
            ajaxExe({
                url : '/webreg2/svc/wradapter/secure/get-cal-grant-message',
                dataType : 'json', // we get string
                type : 'GET',
                async : false,
                data : {
                    "alevel" : urlParam2, "termcode" : urlParam1, "termyear" : termYear
                },
                successF : function(data)
                {
                    if (data.length > 0)
                    {
                        if (data[0].CALGRANT !== undefined
                            && data[0].CALGRANT == "OK")
                        {
                            /** display the modal dialog with checkbox * */
                            // $("#cal-grant-status").show();
                            $("#cal-grant-status")
                                .dialog(
                                    {
                                        autoOpen : true,
                                        width : 590,
                                        height : 280,
                                        position : {
                                            my : "center", at : "center", of : window
                                        },
                                        modal : true,
                                        title : "Notice",
                                        closeOnEscape : false,
                                        open : function(event, ui)
                                        {
                                            $(window).resize(function()
                                            {
                                                $("#cal-grant-status").dialog("option", "position", {
                                                    my : "center", at : "center", of : window
                                                });
                                            });
                                            var isMobile = false; // initiate as false
                                            // device detection
                                            if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|ipad|iris|kindle|Android|Silk|lge |maemo|midp|mmp|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i
                                                .test(navigator.userAgent)
                                                || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i
                                                    .test(navigator.userAgent.substr(0, 4)))
                                            {
                                                isMobile = true;
                                            }
                                            if (!isMobile)
                                            {
                                                $("body").css("overflow", "hidden");
                                            }
                                            $('#checkBox').click(function()
                                            {
                                                if ($('#submit_button').is(':disabled'))
                                                {
                                                    $('#submit_button').removeAttr('disabled');
                                                    $("#submit_button").click(function()
                                                    {
                                                        saveFlag();
                                                        $("#cal-grant-status").dialog("close");
                                                        $("body").css("overflow", "auto");
                                                    });
                                                }
                                                else
                                                {
                                                    $('#submit_button').attr('disabled', 'disabled');
                                                }
                                            });
                                        }

                                    });

                            return false;
                        }
                        else
                        {
                            /** dont show modal dialog * */
                            $("#cal-grant-status").hide();
                            return false;
                        }
                    }
                }
            });

        }
    }
}
/**
 * write a function that takes the value of the checkbox, PID and term and saves it in the table . Once update is a
 * success, return false and quit the function*
 */
function saveFlag()
{
    ajaxExe({
        url : '/webreg2/svc/wradapter/secure/save-cal-grant-flag', dataType : 'text', type : 'POST', async : false, data : {
            "termCode" : urlParam1
        }, successF : function(data)
        {
            if (data == "success")
            {
                return false;
            }
            if (data == "fail")
            {
                errHandle();
            }
        }, error : errHandle
    });
}
function errHandle()
{
    displayGeneralErrorMsg("<div class='msg error'><h4>System Error</h4><span>Please try again and if error persists, come back at a later time and try</span></div>");
    return;
}

// alert build
showHideAlert();
showHideConflictAlert();

// remove spinner and display content after page is loaded
$('#wr-main-content').css('display', 'block');
$("body").removeClass("wr-spinner-loading");
});

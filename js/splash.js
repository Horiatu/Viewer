define([
    "dojo/Evented", "dojo/_base/declare", "dojo/_base/window", "dojo/_base/fx",
    "dojo/_base/html", "dojo/_base/lang", "dojo/has", "dojo/dom", "dojo",
    "dojo/dom-class", "dojo/dom-style", "dojo/dom-attr", "dojo/dom-construct", "dojo/dom-geometry",
    "dojo/on", "dojo/mouse", "dojo/query", "dojo/Deferred", "dijit/form/Button", "dijit/form/CheckBox", "application/wabutils",
    "dojo/cookie", "esri/urlUtils", "esri/lang",
    "dijit/_WidgetBase"], function (
    Evented, declare, win, fx, html, lang, has, dom, dojo,
    domClass, domStyle, domAttr, domConstruct, domGeometry,
    on, mouse, query, Deferred, Button, CheckBox, wabutils,
    cookie, esriUrlUtils, esriLang,
    _WidgetBase) {
    return declare("SplashScreen", [Evented, _WidgetBase], {

        //Public Members
        content: "Loading...",
        screenBackgroundColor: null,
        screenWidthRatio: null,
        splashScreenHeightRatio: null,
        closeButtonLabel: null,
        overlayNode: null,
        shouldShow: true,
        checkboxText: "Do not display next time",

        //Private Members
        _splashDisplayCheckbox: null,
        _splashMessageDivIdentifier: 'splashMessage',
        _splashCheckBoxDivIdentifier: 'splashCheckboxDivIdentifier',
        _splashCheckBoxLabelIdentifier: 'splashCheckboxLabelIdentifier',
        _splashButtonDivIdentifier: 'splashButtonDiv',
        _spashButtonIdentifier: 'splashButton',
        _splashCheckBoxIdentifier: 'splashCheckBoxIdentifier',
        _loadingMessageClasses: 'loadingOverlay pageOverlay',

        /*The cookie information is used to save preferences about showing or not the splash screen.*/
        _cookie: null, //Cookie value must be boolean or null. It is used to populate default value of a checkbox.
        _cookie_key: null,//The key of the cookie. It will be generated to be based on the application identifier
        _cookie_time: 31536000,//The time duration for cookies in seconds. 1 year.
        _cookie_path: '/',//The path to the cookie


        /**
         * Create the content of the splash screen. The splash screen is composed
         * of a message and a button. Elements are contained in divs stacked
         * on the top of each other.
         * @param {Object} content The content of the splash screen that will be displayed
         * to the user. It can be rich text, html, or plain string.
         * @return undefined.
         */
        _createOverlayNode: function(content){

            //Create the content of the splash screen
            var loadingOverlay = this.overlayNode;
            //domAttr.set(this.overlayNode.id, 'class', this._loadingMessageClasses);
            loadingOverlay.style.backgroundColor = this.screenBackgroundColor || "White";




            //Compute the position of the splash screen on the screen
            var ratioWidth = this.screenWidthRatio || 75;
            var ratioHeight = this.splashScreenHeightRatio || 75;
            var verticalMargin = (100-ratioHeight) / 2 + "%";
            var horizontalMargin = (100-ratioWidth) / 2 + "%";
            loadingOverlay.style.top = verticalMargin;
            loadingOverlay.style.left = horizontalMargin;
            loadingOverlay.style.width = ratioWidth + "%";
            loadingOverlay.style.height = ratioHeight + "%";


            //Attach the text to the overlay
            var loadingMessage = domConstruct.create('div', {
                id: this._splashMessageDivIdentifier,
                'class': 'splashContentCommon splashText',
                innerHTML: content + '</br>'
            }, loadingOverlay);
            loadingMessage.tabIndex = 0;
            domAttr.set(this._splashMessageDivIdentifier, 'aria-labelledby', content);


            var wrapperDiv = domConstruct.create('div', {
                id: 'splashFooterDiv',
                'class': 'splashContentCommon splashButton'
            }, loadingOverlay);

            //Create the container for the checkbox and its text
            var checkBoxDiv = domConstruct.create('div', {
                id: this._splashCheckBoxDivIdentifier,
                'class': 'padded'
            }, wrapperDiv);

            domConstruct.create('label',{
                id: this._splashCheckBoxLabelIdentifier,
                innerHTML: this.checkboxText,
                'for': "splashHide"
            }, checkBoxDiv);

            this._splashDisplayCheckbox = domConstruct.create('input', {
                type: 'checkbox',
                id: this._splashCheckBoxIdentifier,
                name: "splashHide",
                value: "splashHide",
                checked: false,
                'class': 'scaledElement'
            }, checkBoxDiv);
            this._splashDisplayCheckbox.tabIndex = 0;

            //domAttr.set(this._splashCheckBoxIdentifier, 'class', 'scaledElement');
            domAttr.set(this._splashCheckBoxIdentifier, 'aria-label', this.checkboxText);

            var closeButtonDiv = domConstruct.create('div', {
                id: this._splashButtonDivIdentifier,
                'class': 'padded'
            }, wrapperDiv);

            //Add a button to the splash container
            var buttonLabel = this.closeButtonLabel||"OK";
            var closeButton = new Button({
                id: this._spashButtonIdentifier,
                label: buttonLabel,
                'class': 'btn',
                onClick: dojo.hitch(this, function(){
                    this.hide();
                })
            });

            closeButton.tabIndex = 0;
            closeButton.startup();
            closeButton.placeAt(closeButtonDiv)
            domAttr.set(this._spashButtonIdentifier, 'aria-labelledby', buttonLabel);
            return loadingOverlay;
        },

        /**
         * Populate the checkbox value. Having a separate function is required
         * since the checkbox value can be updated after the creation of the splash
         * screen.
         * @return undefined.
         */
        _populateCheckBoxValue: function(){

            if (this._splashDisplayCheckbox == null){
                console.warn("Checkbox does not exist");
                return;
            }

            domAttr.set(this._splashCheckBoxIdentifier, 'checked', !this.shouldShow);
        },

        /**
         * The constructor of the splash widget.
         * @param {Object} config The optopms object passed to the constructor. Vaid option are:
                                    1. screenRatio
                                    2. content
                                    3. screenBackgroundColor
                                    4. closeButtonLabel
         * @param {Object} srcNode The content of the splash screen that will be displayed
         * @return undefined.
         */
        constructor: function (config, srcNode) {
            if (config != null){
                this.content =  config.content;
                this.screenBackgroundColor = config.screenBackgroundColor;
                this.screenWidthRatio = config.screenWidthRatio;
                this.splashScreenHeightRatio = config.splashScreenHeightRatio;
                this.closeButtonLabel = config.closeButtonLabel;
                this.checkboxText = config.checkboxText;
            }

            this.overlayNode = srcNode;
            //Check if there is a cooking for not showing the  splash
            this._cookie_key = this._getCookieKey();
            var _cookie = cookie(this._cookie_key);

            if (esriLang.isDefined(_cookie) && _cookie.toString() === 'false') {
              this.shouldShow = false;
            }

            //Show the splash
            this._createOverlayNode(this.content);
        },

        /**
        * Show the splash screen
        * @return undefined.
        **/
        show: function(){
            if (!this.overlayNode){
                this.overlayNode = this._createOverlayNode(this.content);
            }
            else{
                domAttr.set('splashOverlay', 'class', this._loadingMessageClasses)
            }
            this._populateCheckBoxValue();
            dom.byId(this._splashMessageDivIdentifier).focus();
            this.overlayNode.focus();
        },

        /**
        * Hide the splash screen
        * @return undefined.
        **/
        hide: function(){
            //Get the value of the checkbox and set the cookie accordingly.
            var checkbox = dom.byId(this._splashCheckBoxIdentifier);
            cookie(this._cookie_key, !checkbox.checked, {
              expires: this._cookie_time,
              path: this._cookie_path
            });

            //Sync the should show attribute with the checkbox.
            this.shouldShow = !checkbox.checked;

            //Hide the splash screen
            domAttr.set('splashOverlay', 'class', 'splashHidden');
        },

        _getCookieKey: function() {
          return 'show_splash_' + encodeURIComponent(wabutils.getAppIdFromUrl());
        },

    });
});

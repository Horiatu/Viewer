define(["dojo/Evented", "dojo/_base/declare", "dojo/_base/lang", "dojo/has", "esri/kernel", 
    "dijit/_WidgetBase", "dijit/_TemplatedMixin", "dijit/registry",
    "dojo/on", 
    "esri/tasks/locator", "esri/geometry/webMercatorUtils",
    "dojo/Deferred", "dojo/query", 
    "dojo/text!application/GeoCoding/templates/GeoCodingHeader.html", 
    "dojo/dom", "dojo/dom-class", "dojo/dom-attr", "dojo/dom-style", "dojo/dom-construct", "dojo/_base/event", 
    "dojo/parser", "dojo/ready",
    "dijit/layout/ContentPane",    
    "dojo/string", 
    "dojo/i18n!application/nls/PopupInfo",
    "esri/domUtils",
    // "esri/dijit/Popup",
    "dijit/TooltipDialog",
    "dojo/NodeList-dom", "dojo/NodeList-traverse"
    
    ], function (
        Evented, declare, lang, has, esriNS,
        _WidgetBase, _TemplatedMixin, registry,
        on, 
        Locator, webMercatorUtils,
        Deferred, query,
        GeoCodingHeaderTemplate, 
        dom, domClass, domAttr, domStyle, domConstruct, event, 
        parser, ready,
        ContentPane,
        string,
        i18n,
        domUtils,
        // Popup,
        Tooltip
    ) {

    // ready(function(){
    //     // Call the parser manually so it runs after our widget is defined, and page has finished loading
    //     parser.parse();
    // });

    var Widget = declare("esri.dijit.GeoCodingHeader", [_WidgetBase, _TemplatedMixin, Evented], {
        // templateString: GeoCodingHeaderTemplate,

        options: {
            map: null,
            toolbar: null, 
            header: 'pageHeader_geoCoding',
            id: 'geoCodingHeadrId',
            popupInfo: null,
            superNavigator: null,
            iconColor: 'white',
            template: GeoCodingHeaderTemplate,
            self: null,
        },

        constructor: function (options, srcRefNode) {
            var defaults = lang.mixin({}, this.options, options);
            this.domNode = srcRefNode;
            this.widgetsInTemplate = true;

            this.map = defaults.map;
            this.toolbar = defaults.toolbar;
            this.templateString = defaults.template;
            this.popupHeaderId = defaults.id;
            this._i18n = i18n;
            this.headerNode = dom.byId(defaults.header);
            this.popupInfo = defaults.popupInfo;
            this.emptyMessage = defaults.emptyMessage;
            this.contentPanel = defaults.contentPanel;
            this.self = defaults.self;
            this.iconColor=defaults.iconColor;

            this.locator = new Locator("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer");
        },

        startup: function () {
            if (!this.map || !this.toolbar) {
                this.destroy();
                console.log("PopupInfo: map or toolbar required");
            }
            if (this.map.loaded) {
                this._init();
            } else {
                on.once(this.map, "load", lang.hitch(this, function () {
                    this._init();
                }));
            }
        },

//https://developers.arcgis.com/javascript/3/sandbox/sandbox.html?sample=popup_sidepanel

        total:0,

        _init: function () {

            this.loaded = true;

            // var popup = this.map.infoWindow;

            on(query('#'+this.popupHeaderId+' .popupInfoButton.tooltips')[0], 'click', lang.hitch(this, this.switchTooltips));
            on(query('#'+this.popupHeaderId+' .popupInfoButton.zoom')[0], 'click', lang.hitch(this, this.zoomTo));
            on(query('#'+this.popupHeaderId+' .popupInfoButton.map')[0], 'click', lang.hitch(this, this.toMap));
            on(query('#'+this.popupHeaderId+' .popupInfoButton.clear')[0], 'click', lang.hitch(this, this.clearAddress));

            var buttons = query(".popupInfoButton");
            buttons.forEach(lang.hitch(this, function (btn) {
                on(btn,'keydown', lang.hitch(this, function(ev) {
                    switch(ev.keyCode) {
                        case 13: 
                            btn.click();
                            ev.stopPropagation();
                            ev.preventDefault();
                            break;
                        case 40: // down
                            dojo.byId("geoCodingContent").focus();
                            ev.stopPropagation();
                            ev.preventDefault();
                            break;
                        case 90: // Z
                            this.ToZoom();
                            ev.stopPropagation();
                            ev.preventDefault();
                            break;
                        case 77: // M
                        case 80: // P
                            this.ToMap();
                            ev.stopPropagation();
                            ev.preventDefault();
                            break;
                        case 88: // X
                        case 67: // C
                        case 69: // E
                            this.ToClear();
                            ev.stopPropagation();
                            ev.preventDefault();
                            break;
                    }
                }));
            }));

            // on(popup, "SelectionChange", lang.hitch(this, function() {
            //     if(popup.selectedIndex>=0) {
            //         dom.byId('featureIndex').innerHTML = popup.selectedIndex + 1;
            //     }
            // }));

            // on(popup, "SetFeatures", lang.hitch(this, function() {
            //     if(popup.features && popup.features.length > 0) {
            //         // this.setTotal(popup.features.length);
            //     }
            //     else {
            //         this.clearFeatures();
            //     }
            // }));

        },

        ToZoom: function() {
            query('.popupInfoButton.zoom')[0].focus();
        },

        ToMap : function() {
            var _toMap = query('.popupInfoButton.map')[0];
            _toMap.focus();
            _toMap.click();
        },

        ToClear : function() {
            query('.popupInfoButton.clear')[0].focus();
        },

        clearAddress : function(ev) {
            lang.hitch(self, this.self.clearSearchGraphics());
            this.contentPanel.set("content", i18n.widgets.geoCoding.instructions);
            this.map.container.focus();
        },

        toMap : function(ev) {
            this.map.container.focus();
            this.clearSuperNavigator();
       },

        showTooltip: function (evt, address){
            this.closeDialog();
            var tipContent = 
            address.Addr_type+' <b>'+address.Type+'</b><br/>'+
                address.Match_addr;
                // "<b>Status</b>: " + evt.graphic.attributes.STATUS +
                // "<br><b>Cummulative Gas</b>: " + evt.graphic.attributes.CUMM_GAS + " MCF" +
                // "<br><b>Total Acres</b>: " +  evt.graphic.attributes.APPROXACRE +
                // "<br><b>Avg. Field Depth</b>: " + evt.graphic.attributes.AVGDEPTH + " meters";

            var dialog = new dijit.TooltipDialog({
                id: "tooltipDialog",
                content: tipContent,
                class: "addressToolTip",
                style: "top:"+(evt.offsetY+20)+"px; left:"+(evt.offsetX-10)+"px;"
            });
            dialog.startup();

            dojo.style(dialog.domNode, "opacity", 0.75);
            // dijit.placeOnScreen(dialog.domNode, {x: evt.pageX, y: evt.pageY}, ["TL", "BL"], {x: 10, y: 10});
            domConstruct.place(dialog.domNode, query('#mapDiv')[0]);
        },

        closeDialog: function () {
            var widget = dijit.byId("tooltipDialog");
            if (widget) {
                widget.destroy();
            }
        },

        switchTooltips : function(ev) {
            if(this.locator) {
                if(dojo.hasClass(ev.target, 'activeBg')) {
                    domClass.remove(ev.target, 'activeBg');
                    // remove
                }
                else {
                    domClass.add(ev.target, 'activeBg');
                    this.map.on('mouse-move', lang.hitch(this, this.hoverMap));
                }
            }
        },

        locatorProcessing: false,

        hoverMap : function(ev) {
            // console.log('mapClick', evt);
            if(!this.toolbar.IsToolSelected('geoCoding')) return;
            // this.clearSearchGraphics();
            if(!this.locatorProcessing) {
                this.locatorProcessing = true;
                this.locator.locationToAddress(
                    webMercatorUtils.webMercatorToGeographic(ev.mapPoint), 100,
                    lang.hitch(this, function(evt) {
                        this.showTooltip(ev, evt.address);
                        console.log(evt.address.Addr_type,'/', evt.address.Type, ': ', evt.address.Match_addr);
                        this.locatorProcessing = false;
                    }),
                    lang.hitch(this, function(error) {
                        console.log(error);
                        this.locatorProcessing = false;
                    })
                )
            }
        },

        zoomTo : function(ev) {
            this.panZoom();
            this.clearSuperNavigator();
        },

        panZoom: function() {
            var marker = this.self.geoCodingMarkerGraphic;
            if(marker) {
                var addrType = marker.attributes.Addr_type;
                var zoomLevel = 13;
                switch (addrType) {
                    case 'PointAddress' :
                        zoomLevel = 18;
                        break;
                    case 'StreetAddress' :
                    case 'StreetName' :
                        zoomLevel = 16;
                        break;
                    case 'Park' :
                        zoomLevel = 15;
                        break;
                    case 'Locality' :
                        zoomLevel = 10;
                        break;
                    case 'Postal' :
                        zoomLevel = 8;
                        break;
                }
                this.map.centerAndZoom(this.self.geoCodingMarkerGraphic.geometry, zoomLevel);
            }
        },

        clearSuperNavigator: function() {
            if(this.superNavigator) 
                this.superNavigator.clearZone();
        },


    });
    if (has("extend-esri")) {
        lang.setObject("dijit.GeoCodingHeader", Widget, esriNS);
    }
    return Widget;
});

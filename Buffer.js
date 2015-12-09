define([
    'dojo/_base/declare',
    'dijit/_WidgetBase',
    'dijit/_TemplatedMixin',
    'dijit/_WidgetsInTemplateMixin',
    'dijit/form/Button',
    'dojo/_base/lang',
    'dojo/_base/array',
    'dojo/dom', 
    'dojo/domReady!',
    'dojo/aspect',
    'dojo/on',
    'dojo/text!./Buffer/templates/Buffer.html',
    'dojo/topic',
    'xstyle/css!./Buffer/css/Buffer.css',
    'dojo/dom-construct',
    'dojo/_base/Color',
    'esri/geometry/webMercatorUtils',
    'esri/toolbars/draw',
    'dijit/form/Select',
    'esri/graphic',
    'esri/symbols/SimpleFillSymbol',
    'esri/symbols/SimpleLineSymbol',
    'esri/Color',
    'esri/geometry/Point',
    'esri/symbols/SimpleMarkerSymbol',
    'esri/tasks/BufferParameters',
    'esri/tasks/GeometryService',
    'esri/geometry/normalizeUtils',
    'esri/graphicsUtils'
], function (declare, _WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin, Button, lang, arrayUtils, dom, ready, aspect, on, template, topic, css, 
    domConstruct, Color1, webMercatorUtils, Draw, Select, Graphic, SimpleFillSymbol, SimpleLineSymbol, Color, Point, SimpleMarkerSymbol, BufferParameters, 
    GeometryService, normalizeUtils, graphicsUtils) {
    var map;
    var clickmode;
    var drawToolbar;
    var theGeometry;
    var xCenter;
    var yCenter;
    var normalizedValMin;
    var normalizedValMax;
    var centerPoint, centerSymbol;

    return declare([_WidgetBase, _TemplatedMixin, _WidgetsInTemplateMixin], {
        name: 'Buffer',
        map: true,
        widgetsInTemplate: true,
        templateString: template,
        mapClickMode: null,

        postCreate: function(){
            this.inherited(arguments);
            map = this.map;

            drawToolbar= new Draw(this.map);
            drawToolbar.on("draw-end", lang.hitch(this, 'doBuffer'));
            this.own(topic.subscribe("mapClickMode/currentSet", lang.hitch(this, "setMapClickMode")));

            if (this.parentWidget) {
                if (this.parentWidget.toggleable) {
                    this.own(aspect.after(this.parentWidget, 'toggle', lang.hitch(this, function () {
                        this.onLayoutChange(this.parentWidget.open);
                    })));
                }
            }

            map.on('mouse-up', lang.hitch(this, 'onDrawBuffer'));

        },

        onLayoutChange: function (open) {
            if (open) {
            //this.onOpen();
                this.disconnectMapClick();
                drawToolbar.activate(Draw.FREEHAND_POLYGON);
                this.map.setMapCursor('crosshair');
            } else {
                this.onClear();
            }
        },

        disconnectMapClick: function() {
            topic.publish("mapClickMode/setCurrent", "draw");
        },

        connectMapClick: function() {
            topic.publish("mapClickMode/setDefault");
        },

        addToMap: function (evt) {
            console.log("2");
            var symbol = new SimpleFillSymbol(
                SimpleFillSymbol.STYLE_SOLID, 
                new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT, new Color([255, 0, 0]), 2), 
                new Color([255, 255, 0, 0.25])
                );

            var graphic = new Graphic(evt.geometry, symbol);
            map.graphics.add(graphic);
            theGeometry = evt.geometry;
//            this.onCenterTheMap();
//            this.drawIcon();

            this.connectMapClick();
            drawToolbar.deactivate();
            map.setMapCursor("default");
        },



        doBuffer: function(evtObj) {
            drawToolbar.deactivate();
            var geometry = evtObj.geometry, symbol;
            switch (geometry.type) {
                case "point":
                    symbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_SQUARE, 10, new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 1), new Color([0,255,0,0.25]));
                    break;
                case "polyline":
                    symbol = new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASH, new Color([255,0,0]), 1);
                    break;
                case "polygon":
                    symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_NONE, new SimpleLineSymbol(SimpleLineSymbol.STYLE_DASHDOT, new Color([255,0,0]), 2), new Color([255,255,0,0.25]));
                    break;
            }

            var graphic = new Graphic(geometry, symbol);
            map.graphics.add(graphic);

        //    var centerPoint, centerSymbol;
            centerSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CROSS, 24,
                            new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([0,255,0]), 1),
                            new Color([0,255,0,1]));

            switch (graphic.geometry.type) {
                case "point":
                    // if the graphic is a point
                    centerPoint = graphic.geometry;
                    break;
                case "extent":
                    // if the graphic is an extent
                    centerPoint = graphic.getCenter();
                default:
                    // if the graphic is a line or polygon, which for a parcel this will probably
                    // be the case.
                    centerPoint = graphic.geometry.getExtent().getCenter();
            }
//            var centerGraphic = new Graphic(centerPoint, centerSymbol);
//            map.graphics.add(centerGraphic);

            //setup the buffer parameters
            var params = new BufferParameters();
            params.distances = [ dom.byId("bufferDistance").value ];
            params.outSpatialReference = map.spatialReference;
            params.unit = GeometryService[dom.byId("unit").value];
            //normalize the geometry 
            normalizeUtils.normalizeCentralMeridian([geometry]).then(function(normalizedGeometries){
                var normalizedGeometry = normalizedGeometries[0];
                if (normalizedGeometry.type === "polygon") {
                    //if geometry is a polygon then simplify polygon.  This will make the user drawn polygon topologically correct.
                    esriConfig.defaults.geometryService.simplify([normalizedGeometry], function(geometries) {
                        params.geometries = geometries;
                        esriConfig.defaults.geometryService.buffer(params, showBuffer);
                    });
                } else {
                    params.geometries = [normalizedGeometry];
                    esriConfig.defaults.geometryService.buffer(params, showBuffer);
                }
            });  

            function showBuffer(bufferedGeometries) {
                var symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
                    new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0,0.65]), 2),
                    new Color([255,0,0,0.35])
                );

                arrayUtils.forEach(bufferedGeometries, function(geometry) {
                    var graphic = new Graphic(geometry, symbol);
                    map.graphics.add(graphic);
                });

                var centerGraphic = new Graphic(centerPoint, centerSymbol);
                map.graphics.add(centerGraphic);
            }

            this.onCenterTheMap();                     
        },


        showBuffer: function (bufferedGeometries) {
            var symbol = new SimpleFillSymbol(SimpleFillSymbol.STYLE_SOLID,
                new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0,0.65]), 2),
                new Color([255,0,0,0.35])
            );

            arrayUtils.forEach(bufferedGeometries, function(geometry) {
                var graphic = new Graphic(geometry, symbol);
                map.graphics.add(graphic);
            });
        },


        drawIcon: function() {
            var pointSymbol = new SimpleMarkerSymbol();
            pointSymbol.setStyle(SimpleMarkerSymbol.STYLE_CROSS);
            pointSymbol.setSize("24");
            pointSymbol.setColor(new Color([255,0,0]));

            pointSymbol = new SimpleMarkerSymbol(SimpleMarkerSymbol.STYLE_CROSS, 24,
                            new SimpleLineSymbol(SimpleLineSymbol.STYLE_SOLID, new Color([255,0,0]), 1),
                            new Color([0,255,0,1]));

            var point = new Point([xCenter, yCenter]);
            graphic = new Graphic(point, pointSymbol);
            map.graphics.add(graphic);


            var pointSymbol1 = new SimpleMarkerSymbol();
            pointSymbol1.setStyle(SimpleMarkerSymbol.STYLE_CROSS);
            pointSymbol1.setSize("12");
      
            var point1 = new Point([normalizedValMin[0], normalizedValMin[1]]);
            var graphic1 = new Graphic(point1, pointSymbol1);
            map.graphics.add(graphic1);

            var pointSymbol2 = new SimpleMarkerSymbol();
            pointSymbol2.setStyle(SimpleMarkerSymbol.STYLE_CROSS);
            pointSymbol2.setSize("12");
      
            var point2 = new Point([normalizedValMin[0], normalizedValMax[1]]);
            var graphic2 = new Graphic(point2, pointSymbol2);
            map.graphics.add(graphic2);

            var pointSymbol3 = new SimpleMarkerSymbol();
            pointSymbol3.setStyle(SimpleMarkerSymbol.STYLE_CROSS);
            pointSymbol3.setSize("12");
      
            var point3 = new Point([normalizedValMax[0], normalizedValMax[1]]);
            var graphic3 = new Graphic(point3, pointSymbol3);
            map.graphics.add(graphic3);

            var pointSymbol4 = new SimpleMarkerSymbol();
            pointSymbol4.setStyle(SimpleMarkerSymbol.STYLE_CROSS);
            pointSymbol4.setSize("12");
      
            var point4 = new Point([normalizedValMax[0], normalizedValMin[1]]);
            var graphic4 = new Graphic(point4, pointSymbol4);
            map.graphics.add(graphic4);
        },

        onCenterTheMap: function()
        {
        //    console.log(xCenter + ', ' + yCenter);
            if (centerPoint)
            {
                map.centerAt(centerPoint);
                console.log("1");
                var c = webMercatorUtils.webMercatorToGeographic(centerPoint);
                document.getElementById('bufferExtent').value = "center: [" + c.x.toFixed(6) + ", " + c.y.toFixed(6) + "], \n";
            }
           
        },

        onDrawBuffer: function(evt)
        {
            /*
            console.log(dijit.byId('bufferShape').value);
            switch(dijit.byId('bufferShape').value) {
                case "CIRCLE":
                    drawToolbar.activate(Draw.CIRCLE);
                    break;
                case "ELLIPSE":
                    drawToolbar.activate(Draw.ELLIPSE);
                    break;
                case "POLYGON":
                    drawToolbar.activate(Draw.POLYGON);
                    break;
                case "RECTANGLE":
                    drawToolbar.activate(Draw.RECTANGLE);
                    break;
                case "TRIANGLE":
                    drawToolbar.activate(Draw.TRIANGLE);
                    break;
                case "LINE":
                    drawToolbar.activate(Draw.LINE);
                    break;
                case "POLYLINE":
                    drawToolbar.activate(Draw.POLYLINE);
                    break;
                case "FREEHAND_POLYLINE":
                    drawToolbar.activate(Draw.FREEHAND_POLYLINE);
                    break;
                case "POINT":
                    drawToolbar.activate(Draw.POINT);
                    break;                    
                default:
                    drawToolbar.activate(Draw.FREEHAND_POLYGON);
            } 
*/
     //       this.disconnectMapClick();

     //       console.log("1");
     //       var point = evt.mapPoint;
     //       console.log(point);

        },

        onClear: function()
        {
            document.getElementById('currentExtent').value = "";
            this.map.graphics.clear();
            this.connectMapClick();
            drawToolbar.deactivate();
            map.setMapCursor("default");
            theGeometry = null;
        },

        onBufferShapeChange: function (newValue) {
            console.log(newValue.toString());
            switch(newValue.toString()) {
                case "CIRCLE":
                    drawToolbar.activate(Draw.CIRCLE);
                    break;
                case "ELLIPSE":
                    drawToolbar.activate(Draw.ELLIPSE);
                    break;
                case "POLYGON":
                    drawToolbar.activate(Draw.POLYGON);
                    break;
                case "RECTANGLE":
                    drawToolbar.activate(Draw.RECTANGLE);
                    break;
                case "TRIANGLE":
                    drawToolbar.activate(Draw.TRIANGLE);
                    break;
                case "LINE":
                    drawToolbar.activate(Draw.LINE);
                    break;
                case "POLYLINE":
                    drawToolbar.activate(Draw.POLYLINE);
                    break;
                case "FREEHAND_POLYLINE":
                    drawToolbar.activate(Draw.FREEHAND_POLYLINE);
                    break;
                case "POINT":
                    drawToolbar.activate(Draw.POINT);
                    break;                    
                default:
                    drawToolbar.activate(Draw.FREEHAND_POLYGON);
            }            
            this.disconnectMapClick();
        },

        setMapClickMode: function (mode) {
            this.mapClickMode = mode;
        }
    });
});

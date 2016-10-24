function replaceThreeChunkFn(a, b) {
    return THREE.ShaderChunk[b] + '\n';
}

function shaderParse(glsl) {
    return glsl.replace(/\/\/\s?chunk\(\s?(\w+)\s?\);/g, replaceThreeChunkFn);
}    


    function runApp() {

        var sortedData = [] 

        _.each(data.response.checkins.items, function(d){
            var loc = d.venue.location;
            var prevLoc = _.find(sortedData, function(l){ return loc.city === l.city; })
            if (prevLoc) {
                prevLoc.count++;
                if (prevLoc.venues.filter(function(v) { return v === d.venue.name }).length === 0) {
                    prevLoc.venues.push(d.venue.name)
                }
            }
            else {
                loc.count = 1;
                loc.venues = [d.venue.name];


                sortedData.push(loc);
            }
        });

        sortedData = _.sortBy(sortedData, 'count').reverse().filter(function(d) { return typeof d.city !== "undefined" });

        //////3D SCENE/////

        var rotateOffset = Math.PI;

        var scene = new THREE.Scene();
        var aspect = window.innerWidth/window.innerHeight;
        var camera = new THREE.PerspectiveCamera(20, aspect, 0.1, 2000 );
        var renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
        renderer.shadowMapEnabled = true;
        renderer.shadowMapType = THREE.shadowMap;

        var container = document.getElementById("container");

        $("#container").html("");

        renderer.setSize( window.innerWidth, window.innerHeight);

        container.appendChild(renderer.domElement);

        renderer.domElement.style.zIndex = 2;
        renderer.domElement.style.position = "relative";

        camera.position.x = 0;
        camera.position.y = 100;
        camera.position.z = 500;


        light1 = new THREE.SpotLight(0xffffff);
        light1.position.set( -70, 240, 240);
        light1.intensity = 1;
        light1.castShadow = true;
        light1.shadowDarkness = 0.5;
        scene.add(light1);


        light2 = new THREE.PointLight(0x00ff00);
        light2.position.set( 20,120, 120 );

        //////OBJECTS/////

        var parent = new THREE.Object3D();
        var pivot = new THREE.Object3D();
        var labelsGroup = new THREE.Object3D();
        
        pivot.rotation.y = rotateOffset;
        labelsGroup.rotation.y = rotateOffset;

        var globeRadius = 100;

        var geometry = new THREE.SphereGeometry( globeRadius, 64, 64);
        var geometry1 = new THREE.SphereGeometry( globeRadius, 64, 64);
        var material1 = new THREE.MeshBasicMaterial({map : THREE.ImageUtils.loadTexture('img/earthtexture.jpg')});


        var vs = document.getElementById('vertexShader').textContent;
        var fs = document.getElementById('fragmentShader').textContent;

        var material = new THREE.ShaderMaterial({

            // apply the shaderParse to the shaders
            vertexShader: shaderParse(vs),
            fragmentShader: shaderParse(fs),

            // merge the shadow map uniforms to the uniforms we had
            uniforms: THREE.UniformsUtils.merge([
                THREE.UniformsLib.shadowmap,
                {
                    lightPosition: {type: 'v3', value: new THREE.Vector3(700, 700, 700)},
                    time: {type: 'f', value: 0}
                }
            ])
        });

        var shad_material = new THREE.ShadowMaterial();
        shad_material.opacity = 0.25;


        var globe = new THREE.Mesh( geometry, material1 );
        var globe1 = new THREE.Mesh( geometry, shad_material );
        globe1.receiveShadow = true;

        scene.add(parent);
        parent.add(globe);
        parent.add(globe1);
        parent.add(pivot);
        parent.add(labelsGroup);


        //////DATA OBJECTS//////

        var labels = [];
        var labelPositions = [];
        var geos = [];
        var tweens = [];
        var maxCount = sortedData[0].count;
        var highVenuesNum = sortedData[0].venues.length;

        _.map(sortedData, function(d){

            var point = new THREE.BoxGeometry(1, 1, 1);
            point.applyMatrix( new THREE.Matrix4().makeTranslation( 0, 0, -.5 ) );

            var pointMat = new THREE.MeshBasicMaterial({color: 0xffff00, transparent: true, opacity: 0.8});

            var pointObj = new THREE.Mesh(point, pointMat);
            pointObj.scale.x = 0;
            pointObj.scale.y = 0;
            pointObj.scale.z = 0 //d.count;
            

            pointObj.castShadow = true;

            var phi = (90 - d.lat) * Math.PI / 180;
            var theta = (180 - d.lng) * Math.PI / 180;

            pointObj.position.x = globeRadius * Math.sin(phi) * Math.cos(theta);
            pointObj.position.y = globeRadius * Math.cos(phi);
            pointObj.position.z = globeRadius * Math.sin(phi) * Math.sin(theta);
            pointObj.lookAt(globe.position);

            pivot.add(pointObj);

            geos.push({obj: pointObj, height: d.count});

            ////LABEL////
            var label = document.createElement("div");
            label.className = "label";
            label.innerHTML = d.city;
            label.style.fontSize = (d.venues.length / highVenuesNum) * 12 + 12 + 'px';

            if (d.count < 1 || typeof d.city === "undefined") {
                label.style.display = "none";

            }

            container.appendChild(label);

            labels.push(label);

            var labelPos = new THREE.Object3D();

            var objHeight = (d.count / maxCount) * 59 + 1;

            labelPos.position.x = (globeRadius + objHeight) * Math.sin(phi) * Math.cos(theta);
            labelPos.position.y = (globeRadius + objHeight) * Math.cos(phi);
            labelPos.position.z = (globeRadius + objHeight) * Math.sin(phi) * Math.sin(theta);

            labelsGroup.add(labelPos);
            labelPositions.push(labelPos);

            ////TWEEN////
            var scale = {x: 0, y: 0, z: 0};
            var target = {
                x: (d.venues.length / highVenuesNum) + 1,
                y: (d.venues.length / highVenuesNum) + 1,
                z: (d.count / maxCount) * 59 + 1
            }

            var tween = new TWEEN.Tween(scale).to(target).onUpdate( function () {
                pointObj.scale.x = scale.x;
                pointObj.scale.y = scale.y;
                pointObj.scale.z = scale.z;

            });

            tweens.push(tween);

        });


        //////RENDER//////

    var render = function () {

        if (TWEEN.getAll().length > 0) {
            requestAnimationFrame( render );
        }
        TWEEN.update();
        renderLabels();
        renderer.render(scene, camera);
    }


    tweens.forEach(function(twn) {twn.start();})

    var currCity = 0;

    goToCity(currCity);


    function renderLabels() {

        for (var i=0; i < labelPositions.length; i++) {

            var proj = toScreenPosition(labelPositions[i], camera);
           
            labels[i].style.left = proj.x + 'px';
            labels[i].style.top = proj.y + 'px';
            labels[i].style.zIndex = proj.z > 0 ? 3 : 0;
        }
    }

    function toScreenPosition(obj, camera) {
        var vector = new THREE.Vector3();
        var zIndex = new THREE.Vector3();

        var widthHalf = 0.5*renderer.context.canvas.width;
        var heightHalf = 0.5*renderer.context.canvas.height;

        obj.updateMatrixWorld();
        vector.setFromMatrixPosition(obj.matrixWorld);
        vector.project(camera);
         
        parent.updateMatrixWorld()
        zIndex.setFromMatrixPosition(obj.matrixWorld);

        vector.x = ( vector.x * widthHalf ) + widthHalf;
        vector.y = - ( vector.y * heightHalf ) + (heightHalf);

        return { 
            x: vector.x,
            y: vector.y,
            z: zIndex.z
        }

    }


    /*****MOUSE*****/

    window.addEventListener( 'resize', onWindowResize, false );

    function onWindowResize(){

        camera.aspect = window.innerWidth/window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
        render();

    }

    var  mouse3D, isMouseDown = false, onMouseDownPosition,
        radious = 1600, theta = parent.rotation.y, onMouseDownTheta = 0, phi = parent.rotation.x, onMouseDownPhi = 0,
        isShiftDown = false, rotateTween, baseX, baseY;

    onMouseDownPosition = new THREE.Vector2();

    document.addEventListener( 'mousemove', onDocumentMouseMove, false );
    document.addEventListener( 'mousedown', onDocumentMouseDown, false );
    document.addEventListener( 'mouseup', onDocumentMouseUp, false );

    function onDocumentMouseDown( event ) {

        event.preventDefault();

        isMouseDown = true;

        onMouseDownTheta = 0;
        onMouseDownPhi = 0;
        onMouseDownPosition.x = event.clientX;
        onMouseDownPosition.y = event.clientY;
        baseY = parent.rotation.y;
        baseX = parent.rotation.x;
    }

    function onDocumentMouseUp( event ) {

        event.preventDefault();

        isMouseDown = false;

        onMouseDownPosition.x = event.clientX - onMouseDownPosition.x;
        onMouseDownPosition.y = event.clientY - onMouseDownPosition.y;

    }


    function onDocumentMouseMove( event ) {

        event.preventDefault();

        if ( isMouseDown ) {
            
            if (rotateTween) {

                rotateTween.stop();
            }

            theta = - ( ( event.clientX - onMouseDownPosition.x ) * 0.5 ) + onMouseDownTheta;
            phi = ( ( event.clientY - onMouseDownPosition.y ) * 0.5 ) + onMouseDownPhi;

            //phi = Math.min( 180, Math.max( 0, phi ) );

            parent.rotation.y = -theta/100 + baseY;
            parent.rotation.x = phi/100 + baseX;
            render();
        }

    }

    function goToCity(index) {

        var pos = sortedData[index];

        var targetY = (180 - pos.lng) * (Math.PI/180) - 4.6;
        var targetX = -(90 - pos.lat) * (Math.PI/180) + 0.859761281510897;


        var origin = {x: parent.rotation.x, y: parent.rotation.y};
        var target = {x: targetX, y: targetY};

        pivot.children[currCity].material.color.setHex(0xffff00);
        pivot.children[index].material.color.setHex(0xff0000);

        currCity = index;
                                
        if (rotateTween) {

            rotateTween.stop();
        }


        rotateTween = new TWEEN.Tween(origin).to(target, 1000).onUpdate( function () {
            parent.rotation.x = origin.x;
            parent.rotation.y = origin.y;

        }).start();

        render();
    }


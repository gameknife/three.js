/**
 * @author yi kaiming
 * .vrp file loader
 */
// pakFile常数定义

NODE_UNKNOW = 0;
NODE_DIR = 1;
/**< 目录节点，只有该类型节点才能有子节点 */
NODE_BUF = 2;
/**< BUFFER */
NODE_INT = 3;
/**< 整形 */
NODE_FILENAME = 4;
/**< 文件名 */
NODE_STR32 = 5;
/**< 32字节定长字符串 */
NODE_STR64 = 6;
/**< 64字节定长字符串 */
NODE_MATRIX = 7;
/**< Matrix */
NODE_VEC = 8;
/**< Vec3 */
NODE_FLOAT = 9;
/**< float */
NODE_D3DXCOLOR = 10;
/**< VEC4 color; argb; four float */
NODE_GUID = 11;
/**< guid */
NODE_BOX = 12;
/**< BOX */
NODE_CRECT = 13;
/**< CRect */
NODE_FRECT = 14;
/**< frect */
NODE_CSIZE = 15;
/**< CSize */
NODE_FLOAT4 = 16;
/**< Float4 */
NODE_TIME = 17;
/**< CTime */
NODE_QUAT = 18;
/**< quatenion */
NODE_STR128 = 19;
NODE_STR256 = 20;
NODE_BOOL = 21;
NODE_STR = 22;

// D3DFVF
D3DFVF_XYZ = 0x002;
D3DFVF_XYZRHW = 0x004;
D3DFVF_XYZB1 = 0x006;
D3DFVF_XYZB2 = 0x008;
D3DFVF_XYZB3 = 0x00a;
D3DFVF_XYZB4 = 0x00c;
D3DFVF_XYZB5 = 0x00e;
D3DFVF_XYZW = 0x4002;
D3DFVF_NORMAL = 0x010;
D3DFVF_PSIZE = 0x020;
D3DFVF_DIFFUSE = 0x040;
D3DFVF_SPECULAR = 0x080;
D3DFVF_TEX0 = 0x000;
D3DFVF_TEX1 = 0x100;
D3DFVF_TEX2 = 0x200;

function getDataLength(type) {
    switch (type) {
        case NODE_FILENAME:
            return 1024 * 2;
        case NODE_STR32:
            return 32 * 2;
        case NODE_STR64:
            return 64 * 2;
        case NODE_STR128:
            return 128 * 2;
        case NODE_STR256:
            return 256 * 2;
    }

    return 0;
}

function uint16ToString(array) {
    var out, i, len, c;

    out = "";
    len = array.length;
    i = 0;
    while (i < len) {
        c = array[i++];
        switch (c >> 4) {
            case 0:
                return out;
            default:
                out += String.fromCharCode(c);
                break;
        }
    }

    return out;
}

// uint数组转换
function uintToString(array) {
    var out, i, len, c;
    var char2, char3;

    out = "";
    len = array.length;
    i = 0;
    while (i < len) {
        c = array[i++];
        switch (c >> 4) {
            case 0:
                return out;
                break;
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                // 0xxxxxxx
                out += String.fromCharCode(c);
                break;
            case 12:
            case 13:
                // 110x xxxx   10xx xxxx
                char2 = array[i++];
                out += String.fromCharCode(((c & 0x1F) << 6) | (char2 & 0x3F));
                break;
            case 14:
                // 1110 xxxx  10xx xxxx  10xx xxxx
                char2 = array[i++];
                char3 = array[i++];
                out += String.fromCharCode(((c & 0x0F) << 12) |
                    ((char2 & 0x3F) << 6) |
                    ((char3 & 0x3F) << 0));
                break;
        }
    }

    return out;
}

function load_map(tex_dif_filename, tex_dir) {

    var map1 = null;

    var manager = new THREE.LoadingManager();
    manager.onProgress = function (item, loaded, total) {
        console.log(item, loaded, total);
    };

    if (tex_dif_filename != null) {
        var indexpos = tex_dif_filename.lastIndexOf('.');
        var ext = tex_dif_filename.substring(indexpos);

        var loader = null;

        if (ext.toLowerCase() == '.dds') {
            loader = new THREE.DDSLoader(manager);
            map1 = loader.load(tex_dir + tex_dif_filename);
        }

        if (ext.toLowerCase() == '.tga') {
            loader = new THREE.TGALoader(manager);
            map1 = loader.load(tex_dir + tex_dif_filename);
        }

        if (loader == null) {
            map1 = THREE.ImageUtils.loadTexture(tex_dir + tex_dif_filename);
            if (ext.toLowerCase() == '.png') {
                map1.flipY = false;
            }
        }

        if (map1 != null) {

            map1.wrapS = THREE.RepeatWrapping;
            map1.wrapT = THREE.RepeatWrapping;
        }
    }
    return map1;
}

THREE.PakNode = function () {
    // 成员变量
    this.name = '';
    this.id = 0;
    this.parent_id = 0;
    this.node_type = 0;
    this.sub_type = 0;
    this.length = 0;
    this.children = [];
};

THREE.PakNode.prototype = {

    constructor: THREE.PakNode,

    // paknode:find_data
    find_data: function (name) {
        var container = this.find_node(name);
        if (container) {
            return container.value;
        }
        return null;
    },

    // paknode:find_node
    find_node: function (name) {
        for (var node in this.children) {
            if (name === this.children[node].name) {
                return this.children[node];
            }
        }
        return null;
    },
};

// 构造函数
THREE.VRPLoader = function (manager) {

    this.manager = ( manager !== undefined ) ? manager : THREE.DefaultLoadingManager;

    // 成员变量
    this.readoffset = 8;
    this.nodes = [];
    this.dirnodes = [];
    this.root_node = null;

};

THREE.VRPLoader.prototype = {

    constructor: THREE.VRPLoader,

    // get node
    find_node_by_id: function (id) {
        for (var node in this.dirnodes) {

            if (id === this.dirnodes[node].id) {
                return this.dirnodes[node];
            }
        }
        return null;
    },

    // 解析下一个节点
    parse_next_node: function (buffer, offset) {
        var dv = new DataView(buffer, offset, 64);

        var name_string = new Uint8Array(buffer, offset, 48);

        var nodeData = new THREE.PakNode();
        nodeData.name = uintToString(name_string);
        nodeData.id = dv.getInt32(48, true);
        nodeData.parent_id = dv.getInt32(52, true);
        nodeData.node_type = dv.getUint16(56, true);
        nodeData.sub_type = dv.getUint16(58, true);
        nodeData.length = dv.getInt32(60, true);

        this.readoffset += 64;

        this.nodes.push(nodeData);

        if (nodeData.node_type === NODE_DIR) {
            this.dirnodes.push(nodeData);
        }
        else {
            this.readoffset += nodeData.length;
        }

        if (nodeData.parent_id != 0) {
            var parent = this.find_node_by_id(nodeData.parent_id);
            if (parent != null) {
                parent.children.push(nodeData);
            }
        }

        // parse the data
        if (nodeData.length != 0) {
            var dv1 = new DataView(buffer, offset + 64, nodeData.length);
            switch (nodeData.node_type) {
                case NODE_BOOL:
                    nodeData.value = dv1.getUint32(0, true);
                    break;
                case NODE_FLOAT:
                    nodeData.value = dv1.getFloat32(0, true);
                    break;
                case NODE_BOX:

                    break;
                case NODE_BUF:
                    nodeData.value = buffer.slice(offset + 64, offset + 64 + nodeData.length);//new Uint8Array(buffer, offset + 64, nodeData.length);
                    break;
                case NODE_INT:
                    nodeData.value = dv1.getInt32(0, true);
                    break;
                case NODE_MATRIX:
                    nodeData.value = new THREE.Matrix4();
                    nodeData.value.set(dv1.getFloat32(0 * 4, true), dv1.getFloat32(1 * 4, true), dv1.getFloat32(2 * 4, true), dv1.getFloat32(3 * 4, true),
                        dv1.getFloat32(4 * 4, true), dv1.getFloat32(5 * 4, true), dv1.getFloat32(6 * 4, true), dv1.getFloat32(7 * 4, true),
                        dv1.getFloat32(8 * 4, true), dv1.getFloat32(9 * 4, true), dv1.getFloat32(10 * 4, true), dv1.getFloat32(11 * 4, true),
                        dv1.getFloat32(12 * 4, true), dv1.getFloat32(13 * 4, true), dv1.getFloat32(14 * 4, true), dv1.getFloat32(15 * 4, true)
                    );
                    nodeData.value.transpose();
                    break;
                case NODE_FILENAME:
                case NODE_STR32:
                case NODE_STR64:
                case NODE_STR128:
                case NODE_STR256:

                    var sliced = buffer.slice(offset + 64, offset + 64 + getDataLength(nodeData.node_type) / 2);
                    var filenamebuf = new Uint16Array(sliced);
                    nodeData.value = uint16ToString(filenamebuf);

                    break;
            }
        }

        return nodeData;
    },

    load: function (url, onLoad, onProgress, onError) {

        var scope = this;

        var loader = new THREE.XHRLoader(scope.manager);
        loader.setCrossOrigin(this.crossOrigin);
        loader.setResponseType('arraybuffer');
        loader.load(url, function (buffer) {
            onLoad(scope.parse(buffer, url));
        }, onProgress, onError);

    },

    //
    parse: function (buffer, url) {

        console.time('VRPLoader');
        console.log('VRPLoader parsing ' + url);

        // 计算vrp文件的贴图路径
        var tex_dir = url.replace('.vrp', '_textures/');

        // 读取文件头
        var data = new Uint8Array(buffer);
        var vrpData = {
            buffer: buffer,
            flag: [data[0], data[1], data[2], data[3]],
            version: [data[4], data[5], data[6], data[7]],
        };

        // 解析整个文件
        this.root_node = this.parse_next_node(vrpData.buffer, this.readoffset);
        while (this.readoffset < data.length) {
            this.parse_next_node(vrpData.buffer, this.readoffset);
        }

        // 加载物体的缓存容器
        var object, objects = [];
        var geometry, material;

        function clearTemp() {
            geometry = {
                vertices: [],
                normals: [],
                uvs: [],
                uvs2: [],
                indexArray: [],
            };
            material = {
                name: '',
                transparent: false,
                alphaTest: 0,
                side: THREE.FrontSide,
            };
            object = {
                name: '',
                geometry: geometry,
                material: material,
                mat: new THREE.Matrix4(),
                visible: true,
            };
            objects.push(object);
        }

        clearTemp();


        // 开始从root_node加载模型

        // 1.查找模型节点
        var models = this.root_node.find_node('Models6.0');
        if (models == null) {
            models = this.root_node.find_node('Models4.0');
            if (models == null) {
                models = this.root_node.find_node('Models3.0');
                if (models == null) {
                    models = this.root_node.find_node('Models2.0');
                    if (models == null) {
                        models = this.root_node.find_node('Models5.0');
                        if (models == null) {
                            models = this.root_node.find_node('Models');
                            if (models == null) {
                                models = this.root_node.find_node('PES8.0');
                                if (models == null) {
                                    models = this.root_node.find_node('Meshs');
                                }
                            }
                        }
                    }
                }
            }
        }

        // 遍历加载
        if (models != null) {
            for (var i in models.children) {
                var model = models.children[i];

                // 加载一个模型
                if (model != null) {
                    // 取得节点名称
                    var objname = model.name;
                    object.name = objname;

                    // 可见属性，写入object
                    var visible = model.find_data('visible');
                    if (visible != null && visible == 0) {
                        object.visible = false;
                    }

                    // 查找网格数据
                    var imesh = model.find_node('IMesh');
                    if (imesh != null) {
                        // 取得矩阵
                        var mat_aft_local = imesh.find_data('mat_aft_local');
                        object.mat = mat_aft_local;

                        // 先加载材质
                        var map1 = null;
                        var map2 = null;
                        var map3 = null;

                        // 查找并读取diffuse, lightmap, envmap纹理
                        var material = imesh.find_node('Material');
                        var tex_diffuse = material.find_node('TEX_DIFFUSE');
                        if (tex_diffuse != null) {
                            var tex_dif_filename = tex_diffuse.find_data('FILENAME');
                            map1 = load_map(tex_dif_filename, tex_dir);
                        }

                        var tex_lightmap = material.find_node('TEX_LIGHTMAP');
                        if (tex_lightmap != null) {
                            var tex_lm_filename = tex_lightmap.find_data('FILENAME');
                            map2 = load_map(tex_lm_filename, tex_dir);
                        }

                        object.material.map = map1;
                        object.material.lightMap = map2;

                        // 读取材质属性
                        var transp = material.find_data("ENABLE_TRANSP");
                        if (transp == null) {
                            transp = 0;
                        }
                        var transp_type = material.find_data("TRANSP_TYPE");
                        if (transp_type == null) {
                            transp_type = 0;
                        }
                        var blendopt = material.find_data("TRANS_FACTOR");
                        if (blendopt == null) {
                            blendopt = 0;
                        }
                        var twoside = material.find_data("TWO_SIDED");
                        if (twoside > 0) {
                            object.material.side = THREE.DoubleSide;
                        }
                        else {
                            object.material.side = THREE.FrontSide;
                        }

                        var alpharef = material.find_data("ALPHA_REF");
                        if (alpharef == null) {
                            alpharef = 128;
                        }

                        if (transp > 0 && blendopt != 0) {
                            object.material.transparent = true;
                            object.material.alphaTest = 0;
                        }
                        else if (transp > 0) {
                            if (transp_type == 2) {
                                if (alpharef > 0) {
                                    object.material.transparent = false;
                                    object.material.alphaTest = alpharef / 255.0;
                                }
                                else {
                                    object.material.alphaTest = 0;
                                    object.material.transparent = true;
                                }
                            }
                        }
                        else {
                            object.material.transparent = false;
                            object.material.alphaTest = 0.5;
                        }


                        // 开始加载模型

                        // 优化模型
                        var optmized = imesh.find_data('mesh_optimized');

                        if (optmized != null && optmized > 0)
                        {
                            var sysmesh = imesh.find_node('SysMesh');
                            if (sysmesh) {
                                var vert_count = sysmesh.find_data("MESH_VER_COUNT");
                                var face_count = sysmesh.find_data("MESH_FACE_COUNT");

                                var is_dword = sysmesh.find_data("MESH_32BIT_IB");
                                var fvf = sysmesh.find_data("MESH_FVF");

                                var fvfstr = '';

                                var vert_size = 0;
                                if (fvf & D3DFVF_XYZ) {
                                    vert_size += 4 * 3;
                                    fvfstr += '|POS'
                                }
                                if (fvf & D3DFVF_TEX1) {
                                    vert_size += 4 * 2;
                                    fvfstr += '|TEX1'
                                }
                                if (fvf & D3DFVF_TEX2) {
                                    vert_size += 4 * 4;
                                    fvfstr += '|TEX2'
                                }
                                if (fvf & D3DFVF_NORMAL) {
                                    vert_size += 4 * 3;
                                    fvfstr += '|NOR'
                                }
                                if (fvf & D3DFVF_DIFFUSE) {
                                    vert_size += 4;
                                    fvfstr += '|DIF'
                                }

                                var pvb = sysmesh.find_data("MESH_VB");
                                var pib = sysmesh.find_data("MESH_IB");

                                var pvbfloat = new Float32Array(pvb, 0, vert_size / 4 * vert_count);
                                var pibdword = null;
                                if (is_dword > 0) {
                                    pibdword = new Uint32Array(pib, 0, face_count * 3);
                                }
                                else {
                                    pibdword = new Uint16Array(pib, 0, face_count * 3);
                                }


                                console.log('geo|vert:' + vert_count + ' face:' + face_count + ' vertsize:' + vert_size + 'FVF:' + fvfstr);


                                for (var i = 0; i < face_count; ++i) {

                                    var offset = 0;

                                    var index0 = pibdword[i * 3];
                                    var index1 = pibdword[i * 3 + 1];
                                    var index2 = pibdword[i * 3 + 2];

                                    geometry.vertices.push(pvbfloat[index0 * (vert_size / 4) + offset++]);
                                    geometry.vertices.push(pvbfloat[index0 * (vert_size / 4) + offset++]);
                                    geometry.vertices.push(pvbfloat[index0 * (vert_size / 4) + offset++]);

                                    if (fvf & D3DFVF_NORMAL) {
                                        offset += 3;
                                    }

                                    if (fvf & D3DFVF_TEX1) {
                                        geometry.uvs.push(pvbfloat[index0 * (vert_size / 4) + offset++]);
                                        geometry.uvs.push(pvbfloat[index0 * (vert_size / 4) + offset++]);
                                    }
                                    else if (fvf & D3DFVF_TEX2) {
                                        geometry.uvs.push(pvbfloat[index0 * (vert_size / 4) + offset++]);
                                        geometry.uvs.push(1.0 - pvbfloat[index0 * (vert_size / 4) + offset++]);
                                        geometry.uvs2.push(pvbfloat[index0 * (vert_size / 4) + offset++]);
                                        geometry.uvs2.push(1.0 - pvbfloat[index0 * (vert_size / 4) + offset++]);
                                    }

                                    offset = 0;

                                    geometry.vertices.push(pvbfloat[index2 * (vert_size / 4) + offset++]);
                                    geometry.vertices.push(pvbfloat[index2 * (vert_size / 4) + offset++]);
                                    geometry.vertices.push(pvbfloat[index2 * (vert_size / 4) + offset++]);

                                    if (fvf & D3DFVF_NORMAL) {
                                        offset += 3;
                                    }

                                    if (fvf & D3DFVF_TEX1) {
                                        geometry.uvs.push(pvbfloat[index2 * (vert_size / 4) + offset++]);
                                        geometry.uvs.push(pvbfloat[index2 * (vert_size / 4) + offset++]);
                                    }
                                    else if (fvf & D3DFVF_TEX2) {
                                        geometry.uvs.push(pvbfloat[index2 * (vert_size / 4) + offset++]);
                                        geometry.uvs.push(1.0 - pvbfloat[index2 * (vert_size / 4) + offset++]);
                                        geometry.uvs2.push(pvbfloat[index2 * (vert_size / 4) + offset++]);
                                        geometry.uvs2.push(1.0 - pvbfloat[index2 * (vert_size / 4) + offset++]);
                                    }

                                    offset = 0;

                                    geometry.vertices.push(pvbfloat[index1 * (vert_size / 4) + offset++]);
                                    geometry.vertices.push(pvbfloat[index1 * (vert_size / 4) + offset++]);
                                    geometry.vertices.push(pvbfloat[index1 * (vert_size / 4) + offset++]);

                                    if (fvf & D3DFVF_NORMAL) {
                                        offset += 3;
                                    }


                                    if (fvf & D3DFVF_TEX1) {
                                        geometry.uvs.push(pvbfloat[index1 * (vert_size / 4) + offset++]);
                                        geometry.uvs.push(pvbfloat[index1 * (vert_size / 4) + offset++]);
                                    }
                                    else if (fvf & D3DFVF_TEX2) {
                                        geometry.uvs.push(pvbfloat[index1 * (vert_size / 4) + offset++]);
                                        geometry.uvs.push(1.0 - pvbfloat[index1 * (vert_size / 4) + offset++]);
                                        geometry.uvs2.push(pvbfloat[index1 * (vert_size / 4) + offset++]);
                                        geometry.uvs2.push(1.0 - pvbfloat[index1 * (vert_size / 4) + offset++]);
                                    }
                                }
                            }
                        }
                        else
                        {
                            var nomesh = imesh.find_node('NoMesh');
                            if(nomesh != null)
                            {
                                var ver_count = nomesh.find_data("ORIGIN_VER_COUNT");
                                var face_count = nomesh.find_data("ORIGIN_FACE_COUNT");

                                var pos_buffer = nomesh.find_data("ORIGIN_POS_BUF");
                                var face_buffer = nomesh.find_data("ORIGIN_FACE_BUF");

                                var pvbfloat = new Float32Array(pos_buffer, 0, ver_count * 3);
                                var pibdword = new Uint32Array(face_buffer, 0, face_count * 3);

                                console.log('nomesh|vert:' + ver_count + ' face:' + face_count);

                                for (var i = 0; i < face_count; ++i)
                                {

                                    var index0 = pibdword[i * 3];
                                    var index1 = pibdword[i * 3 + 1];
                                    var index2 = pibdword[i * 3 + 2];

                                    geometry.vertices.push(pvbfloat[index0 * 3 + 0]);
                                    geometry.vertices.push(pvbfloat[index0 * 3 + 1]);
                                    geometry.vertices.push(pvbfloat[index0 * 3 + 2]);

                                    geometry.vertices.push(pvbfloat[index1 * 3 + 0]);
                                    geometry.vertices.push(pvbfloat[index1 * 3 + 1]);
                                    geometry.vertices.push(pvbfloat[index1 * 3 + 2]);

                                    geometry.vertices.push(pvbfloat[index2 * 3 + 0]);
                                    geometry.vertices.push(pvbfloat[index2 * 3 + 1]);
                                    geometry.vertices.push(pvbfloat[index2 * 3 + 2]);
                                }


                                var uv_count = nomesh.find_data("ORIGIN_TMAP_COUNT");
                                if(uv_count > 2)
                                {
                                    uv_count = 2;
                                }
                                for(var u=0; u < uv_count; ++u)
                                {
                                    console.log('process uv' + u);
                                    var uv_buffer = nomesh.find_data('ORIGIN_TMAP_UV_' + u);
                                    var uv_face_buffer = nomesh.find_data('ORIGIN_TMAP_FACE_' + u);

                                    var pvbfloat = new Float32Array(uv_buffer, 0, ver_count * 2);
                                    var pibdword = new Uint32Array(uv_face_buffer, 0, face_count * 3);

                                    for (var i = 0; i < face_count; ++i)
                                    {
                                        var index0 = pibdword[i * 3];
                                        var index1 = pibdword[i * 3 + 1];
                                        var index2 = pibdword[i * 3 + 2];

                                        if(u===1)
                                        {
                                            geometry.uvs.push(pvbfloat[index0 * 2 + 0]);
                                            geometry.uvs.push(1.0 - pvbfloat[index0 * 2 + 1]);

                                            geometry.uvs.push(pvbfloat[index1 * 2 + 0]);
                                            geometry.uvs.push(1.0 - pvbfloat[index1 * 2 + 1]);

                                            geometry.uvs.push(pvbfloat[index2 * 2 + 0]);
                                            geometry.uvs.push(1.0 - pvbfloat[index2 * 2 + 1]);
                                        }
                                        else
                                        {
                                            geometry.uvs2.push(pvbfloat[index0 * 2 + 0]);
                                            geometry.uvs2.push(1.0 - pvbfloat[index0 * 2 + 1]);

                                            geometry.uvs2.push(pvbfloat[index1 * 2 + 0]);
                                            geometry.uvs2.push(1.0 - pvbfloat[index1 * 2 + 1]);

                                            geometry.uvs2.push(pvbfloat[index2 * 2 + 0]);
                                            geometry.uvs2.push(1.0 - pvbfloat[index2 * 2 + 1]);
                                        }

                                    }
                                }

                            }
                        }

                        clearTemp();
                    }
                }
            }
        }


        // 开始从加载数据加载three.js mesh
        var container = new THREE.Object3D();

        for (var i = 0, l = objects.length; i < l; i++) {

            object = objects[i];
            geometry = object.geometry;

            var buffergeometry = new THREE.BufferGeometry();
            buffergeometry.addAttribute('position', new THREE.BufferAttribute(new Float32Array(geometry.vertices), 3));

            if (geometry.normals.length > 0) {
                buffergeometry.addAttribute('normal', new THREE.BufferAttribute(new Float32Array(geometry.normals), 3));
            }

            if (geometry.uvs.length > 0) {
                buffergeometry.addAttribute('uv', new THREE.BufferAttribute(new Float32Array(geometry.uvs), 2));
            }

            if (geometry.uvs2.length > 0) {
                buffergeometry.addAttribute('uv2', new THREE.BufferAttribute(new Float32Array(geometry.uvs2), 2));
            }

            //buffergeometry.computeVertexNormals();

            material = new THREE.MeshBasicMaterial();
            material.name = object.name;
            material.map = object.material.map;
            material.lightMap = object.material.lightMap;
            material.transparent = object.material.transparent;
            material.visible = object.visible;
            material.side = object.material.side;
            if (object.material.alphaTest > 0) {
                material.alphaTest = object.material.alphaTest;
            }
            var mesh = new THREE.Mesh(buffergeometry, material);
            mesh.name = object.name;

            mesh.applyMatrix(object.mat);

            container.add(mesh);

        }

        console.timeEnd('VRPLoader');

        return container;

    }

};

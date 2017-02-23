module.exports = function (ret, conf, settings, opt){

    var map = fis.config.get('framework', {});
    var aliasConfig = map.alias || {};
    map.version = fis.config.get('version');
    map.name = fis.config.get('name');
    map.combo = map.combo || false;//由fis的release -p 改成fis3从配置中设置
    map.urlPattern = map.urlPattern || '/c/%s';
    map.comboPattern = map.comboPattern || '/??%s';
    map.hash = fis.util.md5(Date.now() + '-' + Math.random());
    map.alias = {};
    map.deps = {};
    fis.util.map(aliasConfig, function(name, subpath){
        
        var file = ret.src['/' + subpath.replace(/^\//, '')];
        if(file){
            map.alias[name] = file.getId();
        } else {
            map.alias[name] = subpath;
        }
    });
    var aliased = {};
    fis.util.map(map.alias, function(alias, id){
        aliased[id] = alias;
    });
    var views = [];

    
    fis.util.map(ret.src, function(subpath, file){
        var id = file.getId();

        if(file.basename.toLowerCase() === 'component.json'){
            file.release = false;
            delete ret.src[subpath];
        } else if(file.isViews && file.isText()){
            views.push(file);
        } else if(file.isMod && (file.isJsLike || file.isCssLike)){
            if(file.isJsLike){

                var match = file.subpath.match(/^\/(?:app\/components|components)\/(.*?([^\/]+))\/\2\.(js|jsx)$/i);
                if(match && match[1] && !map.alias.hasOwnProperty(match[1])){
                    map.alias[match[1]] = id;
                    
                }
            }

            if(file.requires.length){
                map.deps[id] = file;
            }
        } else if(id in aliased){
            if(file.requires.length){
                map.deps[id] = file;
            }
        }
    });
    aliased = {};
    fis.util.map(map.alias, function(alias, id){
        aliased[id] = alias;
    });

    fis.util.map(map.deps, function(id, file){
        var deps = [];
        file.requires.forEach(function(depId){
            if(map.alias.hasOwnProperty(depId)){
                deps.push(depId);
            } else if(aliased.hasOwnProperty(depId)){
                deps.push(aliased[depId]);
            } else if(ret.ids.hasOwnProperty(depId)) {
                //判断如果是nodeModules文件，那么把带版本号的全路径当成depId
                var nodeId = fis.config.get('nodeModulesMap')[depId];

                deps.push(nodeId || depId);

            } else {
                fis.log.warning('undefined module [' + depId + '] require from [' + file.subpath + ']');
            }
        });

        if(deps.length){
            var nodeId = fis.config.get('nodeModulesMap')[id];
            nodeId && (delete map.deps[id]);

            map.deps[nodeId || id] = deps;
        } else {
            delete map.deps[id];
        }
    });
    if(map.cache){
        var callback = map.defineCSSCallback || 'require.defineCSS';
        fis.util.map(ret.src, function(subpath, file){
            if(file.isCssLike && file.isMod){
                var content = file.getContent();
                content = callback + "('" + file.getId() + "', " + JSON.stringify(content) + ');';
                var f = fis.file(file.realpath);
                f.setContent(content);
                f.compiled = true;
                f.release = file.release + '.js';
                ret.pkg[subpath + '.js'] = f;
            }
        });
    }
    var stringify = JSON.stringify(map, null, opt.optimize ? null : 4);
    views.forEach(function(file){
        var content = file.getContent();
        var hasChange = false;
        content = content.replace(/\b__FRAMEWORK_CONFIG__\b/g, function(){
            hasChange = true;
            return stringify;
        });
        if(hasChange){
            file.setContent(content);
            opt.beforeCompile(file);
        }
    });
};

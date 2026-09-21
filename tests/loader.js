/* 用与思源完全一致的方式加载插件构建产物：
   window.eval("(function anonymous(require,module,exports){" + code + "\n})") */
(async () => {
    try {
        const response = await fetch("/index.js");
        const code = await response.text();
        const module = {exports: {}};
        const requireFunc = (name) => window.require(name);
        window.eval("(function anonymous(require,module,exports){" + code + "\n})")(requireFunc, module, module.exports);
        const PluginClass = module.exports.default || module.exports;
        const plugin = new PluginClass();
        window.__katexHelperPlugin = plugin;
        await plugin.onload();
        window.__pluginEnabled = true;
    } catch (error) {
        window.__errors.push("loader: " + (error && error.stack || String(error)));
    }
})();

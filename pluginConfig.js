// Shared identity for the plugin. PLUGIN_ID MUST be byte-identical to the
// <Id> element in manifest.xml, otherwise WorkflowIntegration.Initialize()
// returns false and GetResolve() yields null.
module.exports = {
    PLUGIN_ID: 'com.gleb.leonardo',
    DEFAULT_MODEL: 'claude-opus-4-8',
};

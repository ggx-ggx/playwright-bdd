module.exports = {
    default: {
        paths: ['src/features/**/*.feature'],
        requireModule: ['ts-node/register'],
        require: ['src/step_definitions/**/*.ts', 'src/support/**/*.ts'],
        format: [
            './src/support/CustomFormatter.js'
        ],
        formatOptions: {
            snippetInterface: 'async-await'
        },
        parallel: 2
    }
}

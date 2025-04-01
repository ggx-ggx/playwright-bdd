import { configure } from '@serenity-js/core';

configure({
    crew: [
        '@serenity-js/console-reporter',
        '@serenity-js/serenity-bdd',
        ['@serenity-js/core:ArtifactArchiver', { outputDirectory: 'target/site/serenity' }]
    ]
}); 
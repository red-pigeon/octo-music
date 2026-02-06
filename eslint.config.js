import vue from 'eslint-plugin-vue'
import vueParser from 'vue-eslint-parser'
import globals from 'globals'

export default [
    {
        files: ['src/**/*.{js,vue}'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: vueParser,
            parserOptions: {
                ecmaVersion: 'latest',
                sourceType: 'module'
            },
            globals: {
                ...globals.browser,
                ...globals.es2021
            }
        },
        plugins: { vue },
        rules: {
            ...(vue.configs?.['flat/recommended']?.rules || {}),
            'no-unused-vars': 'warn',
            'no-undef': 'error',
            eqeqeq: 'warn',
            curly: 'off'
        }
    },
    {
        files: ['electron/**/*.js'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'module',
            globals: {
                ...globals.node,
                ...globals.es2021
            }
        }
    },
    {
        files: ['electron/**/*.cjs'],
        languageOptions: {
            ecmaVersion: 'latest',
            sourceType: 'script',
            globals: {
                ...globals.node,
                ...globals.es2021
            }
        }
    }
]

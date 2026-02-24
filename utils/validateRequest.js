const Validator = require('validatorjs');
const { validationSchema } = require('./validationSchema.js');
const RESPONSE = require('./response.js');

(() => {
    Validator.register(
        'password_pattern',
        value => {
            return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(value);
        },
        'Password must contain 8 or more characters with at least one of each: uppercase, lowercase, number, and special characters!'
    );
})();

const check_validation = async (req, res, next) => {
    const original_url = req.originalUrl;
    const url = original_url.split(`${process.env.API_COMMON_ROUTE || '/api/v1'}`)?.[1]; // /api/v1
    const path = url?.split('?')?.[0];

    const validateSchemaData = validationSchema[path];

    if (validateSchemaData) {
        const { body, query } = req;
        const body_data = { ...body, ...query };
        console.log('Validation body_data:', body_data);

        if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
            console.log('Skipping validation for multipart/form-data');
            return next();
        }

        const { schema, message } = validateSchemaData;
        const validation = new Validator(body_data, schema, message);

        if (validation.fails()) {
            const first_attribute = Object.keys(validation.errors.all())[0];
            const error_message = validation.errors.first(first_attribute);
            console.log('Validation failed:', validation.errors.all());
            return RESPONSE.error(res, 422, error_message, null, null);
        } else {
            console.log('Validation passed');
            return next();
        }
    }
    return next();
};

module.exports = { check_validation };

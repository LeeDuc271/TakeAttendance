const Joi = require('joi');
const fs = require('fs');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      // If there are uploaded files, delete them on validation error
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      if (req.files) {
        req.files.forEach(file => {
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        });
      }
      return res.status(400).json({ status: 'error', message: error.details[0].message });
    }
    next();
  };
};

const schemas = {
  login: Joi.object({
    username: Joi.string().pattern(/^[^<>]*$/).min(3).max(50).required(),
    password: Joi.string().min(6).max(255).required()
  }),
  createClass: Joi.object({
    name: Joi.string().pattern(/^[^<>]*$/).min(2).max(100).required(),
    teacher_id: Joi.alternatives().try(
      Joi.number().integer().positive(),
      Joi.string().min(1)
    ).required()
  }),
  createStudent: Joi.object({
    student_code: Joi.string().pattern(/^[^<>]*$/).min(3).max(20).required(),
    full_name: Joi.string().pattern(/^[^<>]*$/).min(2).max(100).required(),
    class_id: Joi.number().integer().positive().required()
  }),
  scanAttendance: Joi.object({
    class_id: Joi.number().integer().positive().required()
  }),
  saveAttendance: Joi.object({
    class_id: Joi.number().integer().positive().optional(),
    present_ids: Joi.array().items(Joi.string().pattern(/^[^<>]*$/)).required()
  }),
  createTeacher: Joi.object({
    username: Joi.string().pattern(/^[^<>]*$/).min(3).max(50).required(),
    password: Joi.string().min(6).max(255).required()
  }),
  updateTeacher: Joi.object({
    username: Joi.string().pattern(/^[^<>]*$/).min(3).max(50).required(),
    password: Joi.string().min(6).max(255).optional().allow('')
  })
};

const validateIdParam = (req, res, next) => {
  const paramNames = ['id', 'sessionId', 'classId'];
  for (const name of paramNames) {
    if (req.params[name]) {
      const val = req.params[name];
      if (!/^\d+$/.test(val)) {
        return res.status(400).json({ status: 'error', message: `Invalid parameter: ${name} must be a positive integer` });
      }
    }
  }
  next();
};

module.exports = {
  validate,
  schemas,
  validateIdParam
};

const fs = require('fs');
let code = fs.readFileSync('frontend/app.js', 'utf8');

// Insert escapeHTML at the top
if (!code.includes('function escapeHTML')) {
    code = `function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

` + code;
}

code = code
    .replace(/\$\{s\.student_code\}/g, '${escapeHTML(s.student_code)}')
    .replace(/\$\{s\.full_name\}/g, '${escapeHTML(s.full_name)}')
    .replace(/\$\{s\.class_name\}/g, '${escapeHTML(s.class_name)}')
    .replace(/\$\{s\.name\}/g, '${escapeHTML(s.name)}')
    .replace(/\$\{t\.username\}/g, '${escapeHTML(t.username)}')
    .replace(/\$\{c\.name\}/g, '${escapeHTML(c.name)}')
    .replace(/\$\{c\.teacher_name \|\| 'N\/A'\}/g, '${escapeHTML(c.teacher_name || \'N/A\')}')
    .replace(/\$\{p\.full_name\}/g, '${escapeHTML(p.full_name)}')
    .replace(/\$\{p\.student_code \|\| 'N\/A'\}/g, '${escapeHTML(p.student_code || \'N/A\')}')
    .replace(/\$\{student\.full_name\}/g, '${escapeHTML(student.full_name)}')
    .replace(/\$\{student\.student_code \|\| 'N\/A'\}/g, '${escapeHTML(student.student_code || \'N/A\')}')
    .replace(/\$\{err\.file\}/g, '${escapeHTML(err.file)}')
    .replace(/\$\{err\.error\}/g, '${escapeHTML(err.error)}')
    .replace(/TARGET: \$\{className\}/g, 'TARGET: ${escapeHTML(className)}')
    .replace(/\$\{className\}/g, '${escapeHTML(className)}')
    .replace(/\$\{c\.name\.replace\(\/\\'\/\g, "\\\\'"\)\}/g, '${escapeHTML(c.name)}')
    .replace(/escapeHTML\(escapeHTML\(/g, 'escapeHTML(') 
    .replace(/\)\)/g, ')'); 

fs.writeFileSync('frontend/app.js', code);
console.log('Sanitization applied.');

// logger เรียบง่าย มี timestamp + level — ออกทาง stdout/stderr ให้ GitHub Actions เก็บ log
const ts = () => new Date().toISOString();

const fmt = (level, args) =>
  `[${ts()}] [${level}] ${args
    .map((a) => (typeof a === 'string' ? a : JSON.stringify(a)))
    .join(' ')}`;

export const log = {
  info: (...a) => console.log(fmt('INFO', a)),
  warn: (...a) => console.warn(fmt('WARN', a)),
  error: (...a) => console.error(fmt('ERROR', a)),
  step: (...a) => console.log(fmt('STEP', a)),
};

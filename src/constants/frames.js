// จำนวนเฟรมของแต่ละโหมด animation
export const frameCount = {
  waiting: 4,
  processing: 13,
  success: 17,
  fail: 20,
};

// สร้าง path ของภาพแต่ละเฟรมแบบ dynamic
// type: 'waiting' | 'processing' | 'success' | 'fail', index: 0-based
// สังเกต: processing ใช้ prefix สองแบบสลับที่ index 9
export const getFrameSrc = (type, index) => {
  let folder = '';
  let prefix = '';
  if (type === 'waiting') {
    folder = 'waiting';
    prefix = 'bg_refining_wait_';
  } else if (type === 'processing') {
    folder = 'processing';
    prefix = index < 9 ? 'bg_refininga_process_' : 'bg_refining_process_';
  } else if (type === 'success') {
    folder = 'success';
    prefix = 'bg_refining_success_';
  } else if (type === 'fail') {
    folder = 'fail';
    prefix = 'bg_refining_fail_';
  }
  const num = index.toString().padStart(2, '0');
  return `/images/${folder}/${prefix}${num}.webp`;
};

// สร้าง array ของ path รูปแต่ละประเภท
export const getAllFrameSrcs = (type) =>
  Array.from({ length: frameCount[type] }, (_, i) => getFrameSrc(type, i));

// precompute ครั้งเดียวตอน module load — เฟรมเป็นค่าคงที่ ไม่ต้องคำนวณใหม่ทุก render
export const WAITING_FRAMES = getAllFrameSrcs('waiting');
export const PROCESSING_FRAMES = getAllFrameSrcs('processing');
export const SUCCESS_FRAMES = getAllFrameSrcs('success');
export const FAIL_FRAMES = getAllFrameSrcs('fail');
export const ALL_FRAMES = [...WAITING_FRAMES, ...PROCESSING_FRAMES, ...SUCCESS_FRAMES, ...FAIL_FRAMES];

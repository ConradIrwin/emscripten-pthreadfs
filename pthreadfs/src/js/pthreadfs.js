/**
 * @license
 * Copyright 2021 The Emscripten Authors
 * SPDX-License-Identifier: MIT
 */

var SyscallWrappers = {}

let SyscallsFunctions = [
  {'name': 'open', 'args': ['path', 'flags', 'varargs']},
  {'name': 'unlink', 'args': ['path']},
  {'name': 'chdir', 'args': ['path']},
  {'name': 'mknod', 'args': ['path', 'mode', 'dev']},
  {'name': 'chmod', 'args': ['path', 'mode']},
  {'name': 'access', 'args': ['path', 'amode']},
  {'name': 'rename', 'args': ['old_path', 'new_path']},
  {'name': 'mkdir', 'args': ['path', 'mode']},
  {'name': 'rmdir', 'args': ['path']},
  {'name': 'ioctl', 'args': ['fd', 'request', 'varargs']},
  {'name': 'readlink', 'args': ['path', 'buf', 'bufsize']},
  {'name': 'fchmod', 'args': ['fd', 'mode']},
  {'name': 'fchdir', 'args': ['fd']},
  {'name': 'fdatasync', 'args': ['fd']},
  {'name': 'truncate64', 'args': ['path', 'zero', 'low', 'high']},
  {'name': 'ftruncate64', 'args': ['fd', 'zero', 'low', 'high']},
  {'name': 'stat64', 'args': ['path', 'buf']},
  {'name': 'lstat64', 'args': ['path', 'buf']},
  {'name': 'fstat64', 'args': ['fd', 'buf']},
  {'name': 'lchown32', 'args': ['path', 'owner', 'group']},
  {'name': 'fchown32', 'args': ['fd', 'owner', 'group']},
  {'name': 'chown32', 'args': ['path', 'owner', 'group']},
  {'name': 'getdents64', 'args': ['fd', 'dirp', 'count']},
  {'name': 'fcntl64', 'args': ['fd', 'cmd', 'varargs']},
  {'name': 'statfs64', 'args': ['path', 'size', 'buf']},
  {'name': 'fstatfs64', 'args': ['fd', 'size', 'buf']},
  {'name': 'fallocate', 'args': ['fd', 'mode', 'off_low', 'off_high', 'len_low', 'len_high']},
]

let WasiFunctions = [
  {'name': 'write', 'args': ['iovs', 'iovs_len', 'nwritten']},
  {'name': 'read', 'args': ['iovs', 'iovs_len', 'nread']},
  {'name': 'close', 'args': []},
  {'name': 'pwrite', 'args': ['iov', 'iovcnt', "{{{ defineI64Param('offset') }}}", 'pnum']},
  {'name': 'pread', 'args': ['iov', 'iovcnt', "{{{ defineI64Param('offset') }}}", 'pnum']},
  {'name': 'seek', 'args': ["{{{ defineI64Param('offset') }}}", 'whence', 'newOffset']},
  {'name': 'fdstat_get', 'args': ['pbuf']},
  {'name': 'sync', 'args': []},
]

function createWasiWrapper(name, args, wrappers) {
  let full_args = 'fd';
  if (args.length > 0) {
    full_args = full_args + ',' + args.join(',');
  }
  let full_args_with_resume = full_args + ',resume';
  let wrapper = `function(${full_args_with_resume}) {`;
  wrapper += `_fd_${name}_async(${full_args}).then((res) => {`;
  wrapper += 'wasmTable.get(resume)(res);});}'
  wrappers[`__fd_${name}_async`] = eval('(' + wrapper + ')');
  // Additional backends must register a dependency here.
  wrappers[`__fd_${name}_async__deps`] = [`fd_${name}_async`, '$ASYNCSYSCALLS', '$FSAFS'];
}

function createSyscallWrapper(name, args, wrappers) {
  let full_args = '';
  let full_args_with_resume = 'resume';
  if (args.length > 0) {
    full_args = args.join(',');
    full_args_with_resume = full_args + ', resume';
  }
  let wrapper = `function(${full_args_with_resume}) {`;
  wrapper += `_${name}_async(${full_args}).then((res) => {`;
  wrapper += 'wasmTable.get(resume)(res);});}'
  wrappers[`__sys_${name}_async`] = eval('(' + wrapper + ')');
  // Additional backends must register a dependency here.
  wrappers[`__sys_${name}_async__deps`] = [`${name}_async`, '$ASYNCSYSCALLS', '$FSAFS'];
}

for (x of WasiFunctions) {
  createWasiWrapper(x.name, x.args, SyscallWrappers);
}
for (x of SyscallsFunctions) {
  createSyscallWrapper(x.name, x.args, SyscallWrappers);
}

SyscallWrappers['utime_sync'] =
  function(folder_ref, resume) {
  let folder = UTF8ToString(folder_ref);

  PThreadFS.init(folder).then(async () => {
    // Load packaged data added during --pre-js.
    await PThreadFS.loadAvailablePackages();
    wasmTable.get(resume)();
  });
}

// This is copied from utime() as defined in library.js.
SyscallWrappers['utime_sync__deps'] = ['$FS', '$setFileTime'];
SyscallWrappers['utime_sync__proxy'] = 'sync';
SyscallWrappers['utime_sync__sig'] = 'iii';
SyscallWrappers['utime_sync'] = function(path, times) {
  // int utime(const char *path, const struct utimbuf *times);
  // http://pubs.opengroup.org/onlinepubs/009695399/basedefs/utime.h.html
  var time;
  if (times) {
    // NOTE: We don't keep track of access timestamps.
    time = {{{ makeGetValue('times', C_STRUCTS.utimbuf.modtime, 'i32') }}} * 1000;
  } else {
    time = Date.now();
  }
  return setFileTime(path, time);
};

SyscallWrappers['utime_async'] = function(path, times, resume) {
  var time;
  if (times) {
    // NOTE: We don't keep track of access timestamps.
    time = {{{ makeGetValue('times', C_STRUCTS.utimbuf.modtime, 'i32') }}} * 1000;
  } else {
    time = Date.now();
  }
  path = UTF8ToString(path);
  try {
    PThreadFS.utime(path, time, time).then(() => {
      wasmTable.get(resume)(0);
    });
  } catch (e) {
    if (!(e instanceof FS.ErrnoError)) throw e + ' : ' + stackTrace();
    setErrNo(e.errno);
    wasmTable.get(resume)(-1);
  }
};

SyscallWrappers['pthreadfs_init'] =
  function(folder_ref, resume) {
  let folder = UTF8ToString(folder_ref);

  PThreadFS.init(folder).then(async () => {
    // Load packaged data added during --pre-js.
    await PThreadFS.loadAvailablePackages();
    wasmTable.get(resume)();
  });
}

mergeInto(LibraryManager.library, SyscallWrappers);

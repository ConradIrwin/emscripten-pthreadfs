/*
 * Copyright 2013 The Emscripten Authors.  All rights reserved.
 * Emscripten is available under two separate licenses, the MIT license and the
 * University of Illinois/NCSA Open Source License.  Both these licenses can be
 * found in the LICENSE file.
 */

#include <assert.h>
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <unistd.h>
#include <utime.h>

void setup() {
  mkdir("writeable", 0777);
  mkdir("unwriteable", 0111);
  mkdir("persistent/writeable", 0777);
  mkdir("persistent/unwriteable", 0111);
}

void cleanup() {
  rmdir("writeable");
  rmdir("unwriteable");
  rmdir("persistent/writeable");
  rmdir("persistent/unwriteable");
}

void test(const char* writeable, const char* unwriteable) {
  struct stat s;
  // currently, the most recent timestamp is shared for atime,
  // ctime and mtime. using unique values for each in the test
  // will fail.
  struct utimbuf t = {1000000000, 1000000000};

  utime("writeable", &t);
  assert(!errno);
  memset(&s, 0, sizeof s);
  stat("writeable", &s);
  assert(s.st_atime == t.actime);
  assert(s.st_mtime == t.modtime);

  // write permissions aren't checked when setting node
  // attributes unless the user uid isn't the owner
  // (therefore, this should work fine).
  utime(unwriteable, &t);
  assert(!errno);
  memset(&s, 0, sizeof s);
  stat(unwriteable, &s);
  assert(s.st_atime == t.actime);
  assert(s.st_mtime == t.modtime);

  puts("success");
}

int main() {
  setup();
  test("writeable", "unwriteable");
  test("persistent/writeable", "persistent/unwriteable");
  cleanup();
  return EXIT_SUCCESS;
}

/*
 * Copyright 2011 The Emscripten Authors.  All rights reserved.
 * Emscripten is available under two separate licenses, the MIT license and the
 * University of Illinois/NCSA Open Source License.  Both these licenses can be
 * found in the LICENSE file.
 */

#include <stdio.h>
#include <errno.h>
#include <unistd.h>
#include "pthreadfs.h"

int main() {
  puts("WARNING: This test will fail. Update this message if the test succeeds.");

  EM_PTHREADFS_ASM(
    await PThreadFS.mkdir('persistent/working');
    await PThreadFS.mkdir('persistent/test');
    await PThreadFS.chdir('persistent/working');
    await PThreadFS.symlink('../test/../there!', 'link');
    await PThreadFS.writeFile('file', 'test');
    await PThreadFS.mkdir('folder');
  );

  const char* files[] = {"link", "file", "folder"};
  char buffer[256] = {0};

  for (int i = 0; i < sizeof files / sizeof files[0]; i++) {
    printf("readlink(%s)\n", files[i]);
    printf("ret: %zd\n", readlink(files[i], buffer, 256));
    printf("errno: %d\n", errno);
    printf("result: %s\n\n", buffer);
    errno = 0;
  }

  printf("symlink/overwrite\n");
  printf("ret: %d\n", symlink("new-nonexistent-path", "link"));
  printf("errno: %d\n\n", errno);
  errno = 0;

  printf("symlink/normal\n");
  printf("ret: %d\n", symlink("new-nonexistent-path", "folder/link"));
  printf("errno: %d\n", errno);
  errno = 0;

  printf("readlink(created link)\n");
  printf("ret: %zd\n", readlink("folder/link", buffer, 256));
  printf("errno: %d\n", errno);
  printf("result: %s\n\n", buffer);
  errno = 0;

  buffer[0] = buffer[1] = buffer[2] = buffer[3] = buffer[4] = buffer[5] = '*';
  printf("readlink(short buffer)\n");
  printf("ret: %zd\n", readlink("link", buffer, 4));
  printf("errno: %d\n", errno);
  printf("result: %s\n", buffer);
  errno = 0;

  return 0;
}
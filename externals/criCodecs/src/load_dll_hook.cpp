// Redirect all lookups to NODE.EXE to the current process
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <delayimp.h>

static FARPROC WINAPI loadDLLHook(unsigned int event, DelayLoadInfo* info) {
    if (event != dliNotePreLoadLibrary) { return NULL; }
    if (_stricmp(info->szDll, "NODE.EXE") != 0) { return NULL; }

    return (FARPROC)GetModuleHandle(NULL);
}

decltype(__pfnDliNotifyHook2) __pfnDliNotifyHook2 = loadDLLHook;
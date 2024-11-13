#define NAPI_VERSION 9
#include <napi.h>

#include "hca.cpp"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set(Napi::String::New(env, "HcaDecode"),
                Napi::Function::New(env, HcaDecode));
    return exports;
}

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)
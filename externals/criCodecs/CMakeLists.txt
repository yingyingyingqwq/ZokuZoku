cmake_minimum_required(VERSION 3.15)
cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)
set(CMAKE_CXX_STANDARD 17)

project(criCodecs)

add_definitions(-DNAPI_VERSION=9)

set(LIBS ${CMAKE_JS_LIB})
if(MSVC)
    # Generate nodejs def file
    add_custom_command(
        OUTPUT node.lib
        COMMAND ${CMAKE_LINKER} /machine:X64 /def:${CMAKE_CURRENT_SOURCE_DIR}/node.def /out:node.lib
        DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/node.def
        VERBATIM
    )

    add_custom_target(nodelib ALL
        DEPENDS node.lib
        VERBATIM
    )

    set(LIBS ${LIBS} delayimp node)
endif()

add_library(${PROJECT_NAME} SHARED "src/addon.cpp" ${CMAKE_JS_SRC})
set_target_properties(${PROJECT_NAME} PROPERTIES PREFIX "" SUFFIX ".node")
target_link_libraries(${PROJECT_NAME} ${LIBS})
target_include_directories(${PROJECT_NAME} PRIVATE ${CMAKE_JS_INC})
if(MSVC)
    target_link_options(${PROJECT_NAME} PRIVATE "/DELAYLOAD:node.exe")
endif()

# workaround for cmake.js's stupid overriding behavior
set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS_INIT}")
target_compile_definitions(${PROJECT_NAME} PRIVATE BUILDING_NODE_EXTENSION)

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
  # Generate node.lib
  execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()
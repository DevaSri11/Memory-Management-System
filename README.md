# ⚡ High-Performance C++ Memory Allocators & Interactive Visualizer Lab

A modern, production-ready implementation of deterministic C++20 stateful memory allocators (Arena and Pool Allocator) designed for low-latency systems, paired with an interactive, web-based real-time visual execution sandbox.

## 🚀 Key Features

* **Linear Arena Allocator**: $O(1)$ bump allocation with batch reclamation, supporting custom alignment requirements.
* **Fixed-Block Pool Allocator**: Zero-overhead block recycling using an intrusive singly-linked free list (0 bytes of metadata).
* **STL Adapter Wrapper**: Plug custom allocators directly into standard containers like `std::vector` and `std::list`.
* **Interactive C++ Sandbox Visualizer**: Paste C++ code to dynamically parse struct sizes/padding rules and simulate cell allocations step-by-step.
* **Real-time Performance Benchmarks**: Compare custom allocation speeds directly inside the web UI.

---

## 🛠️ How to Build and Run (C++ CLI Benchmarks)

### Prerequisites
* A modern C++20 compiler (GCC 10+, Clang 11+, or MSVC 2019+)
* CMake (Version 3.15 or higher)

### Build Steps
1. Configure the project:
   ```bash
   cmake -B build -S . -DCMAKE_BUILD_TYPE=Release
   ```
2. Compile:
   ```bash
   cmake --build build --config Release
   ```
3. Run the microbenchmarks executable:
   ```bash
   ./build/allocator_bench
   ```

---

## 💻 How to Start the Web Visualizer

Run the following command from the project root to spin up the visualizer server locally:
```bash
python run_ui.py
```
Open **[http://localhost:8000](http://localhost:8000)** in your browser to interact with the visual simulator, inspect free lists, play sandbox steps, and run live browser benchmarks.

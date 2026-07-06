#pragma once
#include <cstddef>
#include <cstdint>
#include <memory>
#include <new>
#include <utility>

class ArenaAllocator {
public:
    explicit ArenaAllocator(size_t totalSize)
        : m_totalSize(totalSize) {
        m_buffer = new uint8_t[m_totalSize];
        m_current = m_buffer;
    }

    ~ArenaAllocator() {
        delete[] m_buffer;
    }

    // Disable copying
    ArenaAllocator(const ArenaAllocator&) = delete;
    ArenaAllocator& operator=(const ArenaAllocator&) = delete;

    // Enable moving
    ArenaAllocator(ArenaAllocator&& other) noexcept
        : m_buffer(std::exchange(other.m_buffer, nullptr))
        , m_totalSize(std::exchange(other.m_totalSize, 0))
        , m_current(std::exchange(other.m_current, nullptr)) {}

    ArenaAllocator& operator=(ArenaAllocator&& other) noexcept {
        if (this != &other) {
            delete[] m_buffer;
            m_buffer = std::exchange(other.m_buffer, nullptr);
            m_totalSize = std::exchange(other.m_totalSize, 0);
            m_current = std::exchange(other.m_current, nullptr);
        }
        return *this;
    }

    void* allocate(size_t size, size_t alignment = alignof(std::max_align_t)) {
        void* ptr = m_current;
        size_t space = m_totalSize - used_memory();
        void* alignedPtr = std::align(alignment, size, ptr, space);
        if (!alignedPtr) {
            throw std::bad_alloc();
        }
        m_current = static_cast<uint8_t*>(alignedPtr) + size;
        return alignedPtr;
    }

    void deallocate(void* ptr, size_t size) noexcept {
        // Arena/Linear allocator does not release individual allocations.
        (void)ptr;
        (void)size;
    }

    void reset() noexcept {
        m_current = m_buffer;
    }

    size_t total_size() const noexcept { return m_totalSize; }
    
    size_t used_memory() const noexcept {
        if (!m_buffer) return 0;
        return static_cast<size_t>(m_current - m_buffer);
    }

    size_t free_memory() const noexcept {
        return m_totalSize - used_memory();
    }

private:
    uint8_t* m_buffer = nullptr;
    size_t m_totalSize = 0;
    uint8_t* m_current = nullptr;
};

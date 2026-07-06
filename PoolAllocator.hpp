#pragma once
#include <cstddef>
#include <cstdint>
#include <memory>
#include <new>
#include <stdexcept>
#include <utility>

template <size_t BlockSize, size_t Alignment = alignof(std::max_align_t)>
class PoolAllocator {
private:
    struct Node {
        Node* next;
    };

    static constexpr size_t align_up(size_t size, size_t alignment) noexcept {
        return (size + alignment - 1) & ~(alignment - 1);
    }

    static constexpr size_t TempBlockSize = BlockSize < sizeof(Node) ? sizeof(Node) : BlockSize;
    static constexpr size_t ActualAlignment = Alignment < alignof(Node) ? alignof(Node) : Alignment;
    
public:
    static constexpr size_t ActualBlockSize = align_up(TempBlockSize, ActualAlignment);

    explicit PoolAllocator(size_t totalSize)
        : m_totalSize(totalSize) {
        
        // Allocate raw memory. Add extra space for alignment adjustments.
        m_rawBuffer = new uint8_t[m_totalSize + ActualAlignment];
        
        void* ptr = m_rawBuffer;
        size_t space = m_totalSize + ActualAlignment;
        m_alignedBuffer = static_cast<uint8_t*>(std::align(ActualAlignment, m_totalSize, ptr, space));
        
        if (!m_alignedBuffer) {
            delete[] m_rawBuffer;
            throw std::bad_alloc();
        }
        
        reset();
    }

    ~PoolAllocator() {
        delete[] m_rawBuffer;
    }

    // Disable copying
    PoolAllocator(const PoolAllocator&) = delete;
    PoolAllocator& operator=(const PoolAllocator&) = delete;

    // Enable moving
    PoolAllocator(PoolAllocator&& other) noexcept
        : m_rawBuffer(std::exchange(other.m_rawBuffer, nullptr))
        , m_alignedBuffer(std::exchange(other.m_alignedBuffer, nullptr))
        , m_totalSize(std::exchange(other.m_totalSize, 0))
        , m_head(std::exchange(other.m_head, nullptr))
        , m_allocatedBlocks(std::exchange(other.m_allocatedBlocks, 0)) {}

    PoolAllocator& operator=(PoolAllocator&& other) noexcept {
        if (this != &other) {
            delete[] m_rawBuffer;
            m_rawBuffer = std::exchange(other.m_rawBuffer, nullptr);
            m_alignedBuffer = std::exchange(other.m_alignedBuffer, nullptr);
            m_totalSize = std::exchange(other.m_totalSize, 0);
            m_head = std::exchange(other.m_head, nullptr);
            m_allocatedBlocks = std::exchange(other.m_allocatedBlocks, 0);
        }
        return *this;
    }

    void* allocate() {
        if (!m_head) {
            throw std::bad_alloc();
        }
        Node* node = m_head;
        m_head = m_head->next;
        m_allocatedBlocks++;
        return reinterpret_cast<void*>(node);
    }

    void deallocate(void* ptr) noexcept {
        if (!ptr) return;
        
        Node* node = reinterpret_cast<Node*>(ptr);
        node->next = m_head;
        m_head = node;
        m_allocatedBlocks--;
    }

    void reset() noexcept {
        m_head = nullptr;
        m_allocatedBlocks = 0;
        
        size_t maxBlocks = m_totalSize / ActualBlockSize;
        if (maxBlocks == 0) return;
        
        for (size_t i = 0; i < maxBlocks; ++i) {
            Node* node = reinterpret_cast<Node*>(m_alignedBuffer + (i * ActualBlockSize));
            node->next = m_head;
            m_head = node;
        }
    }

    size_t total_size() const noexcept { return m_totalSize; }
    size_t block_size() const noexcept { return ActualBlockSize; }
    size_t max_blocks() const noexcept { return m_totalSize / ActualBlockSize; }
    size_t allocated_blocks() const noexcept { return m_allocatedBlocks; }
    size_t free_blocks() const noexcept { return max_blocks() - m_allocatedBlocks; }

private:
    uint8_t* m_rawBuffer = nullptr;
    uint8_t* m_alignedBuffer = nullptr;
    size_t m_totalSize = 0;
    Node* m_head = nullptr;
    size_t m_allocatedBlocks = 0;
};

#pragma once
#include <cstddef>
#include <new>
#include <type_traits>

// Forward declarations
class ArenaAllocator;

template <size_t BlockSize, size_t Alignment>
class PoolAllocator;

/**
 * @brief An STL-compliant adapter wrapper for custom memory allocators.
 * 
 * This enables the use of custom allocators like ArenaAllocator and PoolAllocator
 * with standard STL containers (e.g., std::vector, std::list, std::unordered_map).
 * 
 * @tparam T The element type to allocate.
 * @tparam AllocatorType The custom allocator implementation type.
 */
template <typename T, typename AllocatorType>
class STLAdapter {
public:
    using value_type = T;
    using propagate_on_container_move_assignment = std::true_type;
    using is_always_equal = std::false_type;

    // Pointer to the underlying stateful allocator instance
    AllocatorType* allocatorInstance;

    explicit STLAdapter(AllocatorType* allocator = nullptr) noexcept
        : allocatorInstance(allocator) {}

    template <typename U>
    STLAdapter(const STLAdapter<U, AllocatorType>& other) noexcept
        : allocatorInstance(other.allocatorInstance) {}

    T* allocate(std::size_t n) {
        if (!allocatorInstance) {
            throw std::bad_alloc();
        }
        
        // Decide allocation strategy based on the allocator type
        if constexpr (std::is_same_v<AllocatorType, ArenaAllocator>) {
            // Arena can allocate arbitrary sizes by pointer-bumping
            return static_cast<T*>(allocatorInstance->allocate(n * sizeof(T), alignof(T)));
        } else {
            // Fixed-size Pool allocator can only allocate 1 block of BlockSize at a time.
            // This is perfect for node-based containers like std::list, std::map, etc.,
            // where n is always 1 and the node size matches the block size.
            if (n != 1 || sizeof(T) > allocatorInstance->block_size()) {
                throw std::bad_alloc();
            }
            return static_cast<T*>(allocatorInstance->allocate());
        }
    }

    void deallocate(T* p, std::size_t n) noexcept {
        if (!allocatorInstance || !p) return;

        if constexpr (std::is_same_v<AllocatorType, ArenaAllocator>) {
            allocatorInstance->deallocate(p, n * sizeof(T));
        } else {
            (void)n;
            allocatorInstance->deallocate(p);
        }
    }

    // Templated rebind structure to allow containers to allocate internal node types
    template <typename U>
    struct rebind {
        using other = STLAdapter<U, AllocatorType>;
    };

    template <typename U>
    bool operator==(const STLAdapter<U, AllocatorType>& other) const noexcept {
        return allocatorInstance == other.allocatorInstance;
    }

    template <typename U>
    bool operator!=(const STLAdapter<U, AllocatorType>& other) const noexcept {
        return allocatorInstance != other.allocatorInstance;
    }
};

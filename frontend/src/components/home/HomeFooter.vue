<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps({
  aboutRoute: {
    type: [String, Object],
    required: true,
  },
  helpRoute: {
    type: [String, Object],
    required: true,
  },
  backgroundOptions: {
    type: Array,
    required: true,
  },
  selectedBackgroundId: {
    type: String,
    required: true,
  },
  maxBackgroundFileSize: {
    type: Number,
    required: true,
  },
  statusMessage: {
    type: String,
    default: '',
  },
})

const emit = defineEmits(['background-selected', 'preset-background-selected', 'background-error'])
const settingsRoot = ref(null)
const settingsButton = ref(null)
const backgroundDialog = ref(null)
const backgroundInput = ref(null)
const isMenuOpen = ref(false)
const isDialogOpen = ref(false)
const uploadError = ref('')
let bodyOverflowBeforeOpen = ''

const maxFileSizeLabel = computed(() => `${props.maxBackgroundFileSize / 1024 / 1024} MB`)
const dialogMessage = computed(() => uploadError.value || props.statusMessage)
const isErrorMessage = computed(
  () =>
    uploadError.value ||
    props.statusMessage.includes('失败') ||
    props.statusMessage.includes('未能'),
)

function closeMenu(shouldReturnFocus = false) {
  isMenuOpen.value = false
  if (shouldReturnFocus) {
    settingsButton.value?.focus()
  }
}

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value
}

function openBackgroundDialog() {
  closeMenu()
  uploadError.value = ''
  isDialogOpen.value = true
}

function closeBackgroundDialog(shouldReturnFocus = false) {
  isDialogOpen.value = false
  uploadError.value = ''

  if (shouldReturnFocus) {
    settingsButton.value?.focus()
  }
}

function openBackgroundPicker() {
  uploadError.value = ''
  backgroundInput.value?.click()
}

function reportUploadError(message) {
  uploadError.value = message
  emit('background-error', message)
}

function handleBackgroundChange(event) {
  const input = event.target
  const file = input.files?.[0]

  if (!file) {
    return
  }

  if (!file.type.startsWith('image/')) {
    reportUploadError('上传失败：请选择 JPG、PNG、WebP 等图片文件')
  } else if (file.size > props.maxBackgroundFileSize) {
    reportUploadError(`图片过大，上传失败。请选择不超过 ${maxFileSizeLabel.value} 的图片`)
  } else {
    uploadError.value = ''
    emit('background-selected', file)
  }

  input.value = ''
}

function selectPreset(backgroundId) {
  uploadError.value = ''
  emit('preset-background-selected', backgroundId)
}

function handlePointerDown(event) {
  if (!settingsRoot.value?.contains(event.target)) {
    closeMenu()
  }
}

function getDialogFocusableElements() {
  return Array.from(
    backgroundDialog.value?.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  )
}

function handleKeydown(event) {
  if (isDialogOpen.value) {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeBackgroundDialog(true)
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const focusableElements = getDialogFocusableElements()
    const firstElement = focusableElements[0]
    const lastElement = focusableElements.at(-1)

    if (!firstElement || !lastElement) {
      return
    }

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
    return
  }

  if (event.key === 'Escape' && isMenuOpen.value) {
    closeMenu(true)
  }
}

watch(isDialogOpen, async (openState) => {
  if (openState) {
    bodyOverflowBeforeOpen = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    await nextTick()
    backgroundDialog.value?.querySelector('button')?.focus()
    return
  }

  document.body.style.overflow = bodyOverflowBeforeOpen
})

onMounted(() => {
  document.addEventListener('pointerdown', handlePointerDown)
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.body.style.overflow = bodyOverflowBeforeOpen
  document.removeEventListener('pointerdown', handlePointerDown)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <footer class="home-footer">
    <RouterLink class="home-footer-link" :to="aboutRoute">About</RouterLink>

    <div ref="settingsRoot" class="home-settings">
      <button
        ref="settingsButton"
        class="home-footer-link home-settings-toggle"
        type="button"
        :aria-expanded="isMenuOpen"
        aria-controls="home-settings-menu"
        @click="toggleMenu"
      >
        <svg
          class="home-settings-icon"
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.61-.22l-2.39.96a7.3 7.3 0 0 0-1.63-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.49.42l-.36 2.54c-.59.24-1.13.56-1.63.94l-2.39-.96a.5.5 0 0 0-.61.22L2.73 8.84a.5.5 0 0 0 .12.64l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.5.5 0 0 0-.12.64l1.92 3.32c.12.22.39.3.61.22l2.39-.96c.5.38 1.04.7 1.63.94l.36 2.54c.05.24.25.42.5.42h3.84c.25 0 .46-.18.49-.42l.36-2.54c.59-.24 1.13-.56 1.63-.94l2.39.96c.22.08.49 0 .61-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
          />
        </svg>
        <span>Settings</span>
      </button>

      <div v-show="isMenuOpen" id="home-settings-menu" class="home-settings-menu" role="menu">
        <button
          class="home-settings-item"
          type="button"
          role="menuitem"
          aria-haspopup="dialog"
          aria-controls="home-background-dialog"
          @click="openBackgroundDialog"
        >
          更换背景
        </button>
        <RouterLink class="home-settings-item" :to="helpRoute" role="menuitem" @click="closeMenu()">
          使用帮助
        </RouterLink>
      </div>
    </div>

    <Teleport to="body">
      <Transition name="home-background-dialog">
        <div
          v-if="isDialogOpen"
          class="home-background-dialog-backdrop"
          @mousedown.self="closeBackgroundDialog(true)"
        >
          <section
            id="home-background-dialog"
            ref="backgroundDialog"
            class="home-background-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="home-background-dialog-title"
          >
            <header class="home-background-dialog-header">
              <h2 id="home-background-dialog-title">更换主页背景</h2>
              <button
                class="home-background-dialog-close"
                type="button"
                aria-label="关闭更换背景弹窗"
                @click="closeBackgroundDialog(true)"
              >
                ×
              </button>
            </header>

            <div class="home-background-dialog-body">
              <section aria-labelledby="home-system-background-title">
                <h3 id="home-system-background-title">系统背景</h3>
                <div class="home-background-grid">
                  <button
                    v-for="background in backgroundOptions"
                    :key="background.id"
                    class="home-background-option"
                    :class="{ 'is-selected': selectedBackgroundId === background.id }"
                    type="button"
                    :aria-pressed="selectedBackgroundId === background.id"
                    @click="selectPreset(background.id)"
                  >
                    <span
                      class="home-background-option-preview"
                      :style="{ backgroundImage: background.preview }"
                      aria-hidden="true"
                    ></span>
                    <span class="home-background-option-copy">
                      <strong>{{ background.name }}</strong>
                    </span>
                    <span
                      v-if="selectedBackgroundId === background.id"
                      class="home-background-option-check"
                      aria-hidden="true"
                    >
                      ✓
                    </span>
                  </button>
                </div>
              </section>

              <section
                class="home-background-upload"
                :class="{ 'is-selected': selectedBackgroundId === 'custom' }"
                aria-labelledby="home-custom-background-title"
              >
                <div>
                  <h3 id="home-custom-background-title">自定义图片</h3>
                  <p>最大 {{ maxFileSizeLabel }}</p>
                  <small v-if="selectedBackgroundId === 'custom'">当前正在使用自定义图片</small>
                </div>
                <button type="button" @click="openBackgroundPicker">选择图片</button>
                <input
                  ref="backgroundInput"
                  class="visually-hidden"
                  type="file"
                  accept="image/*"
                  tabindex="-1"
                  @change="handleBackgroundChange"
                />
              </section>

              <p
                v-if="dialogMessage"
                class="home-background-dialog-message"
                :class="{ 'is-error': isErrorMessage }"
                :role="isErrorMessage ? 'alert' : 'status'"
              >
                {{ dialogMessage }}
              </p>
            </div>

            <footer class="home-background-dialog-footer">
              <button type="button" @click="closeBackgroundDialog(true)">完成</button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>

    <p class="visually-hidden" aria-live="polite">{{ statusMessage }}</p>
  </footer>
</template>

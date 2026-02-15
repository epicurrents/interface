<template>
    <div ref="wrapper" :class="[
        { 'open' : trueOpen },
        'collapsible-wrapper'
    ]">
        <h3>{{ title }}</h3>
        <wa-button
            appearance="outlined"
            class="toggler"
            variant="brand"
            @click="toggleOpen"
        >
            {{ trueOpen ? 'Close' : 'Open' }}
            <wa-icon :name="trueOpen ? 'angle-up' : 'angle-down'" slot="end"></wa-icon>
        </wa-button>
        <slot></slot>
    </div>
</template>


<script lang="ts">
import { defineComponent, Ref, ref } from 'vue'

export default defineComponent({
    name: 'Reporter',
    props: {
        open: {
            type: Boolean,
            required: false,
        },
        title: {
            type: String,
            required: true,
        },
    },
    setup () {
        const trueOpen = ref(false)
        const wrapper = ref<HTMLDivElement>() as Ref<HTMLDivElement>
        return {
            trueOpen,
            wrapper,
        }
    },
    watch: {
        open (value) {
            if (value !== this.trueOpen) {
                this.toggleOpen(value)
            }
        },
        trueOpen () {
            this.resize()
        }
    },
    methods: {
        reload () {
            this.trueOpen = false
            if (this.open) {
                setTimeout(() => {
                    this.trueOpen = true
                }, 100)
            }
        },
        resize () {
            if (!this.wrapper) {
                return
            }
            this.$nextTick(() => {
                const content = this.wrapper.querySelector(':nth-child(3)') as HTMLDivElement
                if (!content) {
                    return
                }
                if (this.trueOpen && content.offsetHeight) {
                    console.debug(`Resizing ${this.title}.`)
                    this.wrapper.style.height = `calc(5.5rem + ${content.offsetHeight}px)`
                } else {
                    this.wrapper.style.height = 'calc(4.5rem)'
                }
            })
        },
        toggleOpen (_event: PointerEvent, value?: boolean) {
            this.trueOpen = value !== undefined ? value : !this.trueOpen
            this.$emit('toggle-open')
            if (this.trueOpen) {
                // The auto-sizing text field needs a while to settle itself.
                setTimeout(() => {
                    this.resize()
                }, 100)
            }
        },
    },
    mounted () {
        setTimeout(() => {
            // First draw after mounting takes quite a bit longer, for some reason...
            this.reload()
        }, 400)
    },
})
</script>

<style scoped>
div.collapsible-wrapper {
    position: relative;
    width: 100%;
    height: 4.5rem;
    margin: 10px 0 0 0;
    padding: 1rem;
    border: solid 1px #e0e0e0;
    border-radius: 5px;
    background-color: var(--wa-color-blue-95);
    overflow-y: hidden;
    transition: height 0.25s;
}
    div.collapsible-wrapper.open {
        padding-bottom: 1.25rem;
    }
h3 {
    width: 100%;
    height: 2.5rem;
    line-height: 2.5rem;
    margin: 0 0 1rem 0;
    color: var(--wa-color-blue-30);
    font-variant: small-caps;
    font-size: 1.25rem;
    font-weight: 700;
    text-align: left;
}
wa-button.toggler {
    position: absolute;
    top: 1rem;
    right: 1rem;
}
</style>

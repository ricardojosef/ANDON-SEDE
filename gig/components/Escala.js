// Escala de 1 a 7 em botões.
export default {
  props: { modelValue: [Number, String, null], min: { type: Number, default: 1 }, max: { type: Number, default: 7 } },
  emits: ["update:modelValue"],
  computed: { valores() { return Array.from({ length: this.max - this.min + 1 }, (_, i) => this.min + i); } },
  template: `
  <div class="escala">
    <small>{{ min }}</small>
    <button type="button" v-for="v in valores" :key="v" :class="{ sel: Number(modelValue) === v }"
            @click="$emit('update:modelValue', Number(modelValue) === v ? null : v)">{{ v }}</button>
    <small>{{ max }}</small>
  </div>`,
};

package cn.mathverse.backend.practice.dto;
import jakarta.validation.constraints.Size;
public record PracticeNoteRequest(@Size(max=5000) String note) {}

package cn.mathverse.backend;

import org.apache.ibatis.annotations.Mapper;
import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan(basePackages = "cn.mathverse.backend", annotationClass = Mapper.class)
public class MathverseApplication {
    public static void main(String[] args) {
        SpringApplication.run(MathverseApplication.class, args);
    }
}

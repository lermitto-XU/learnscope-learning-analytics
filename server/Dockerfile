FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY pom.xml .
RUN mvn -B dependency:go-offline
COPY src ./src
RUN mvn -B package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN groupadd --system learnscope && useradd --system --gid learnscope learnscope
COPY --from=build /workspace/target/learnscope-server-1.0.0.jar /app/server.jar
USER learnscope
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=70", "-jar", "/app/server.jar"]

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /source

COPY ["ecg-test2/ecg-test2.csproj", "ecg-test2/"]
COPY ["DataAccess/DataAccess.csproj", "DataAccess/"]

RUN dotnet restore "ecg-test2/ecg-test2.csproj"

COPY . .

WORKDIR "/source/ecg-test2"
RUN dotnet publish "ecg-test2.csproj" -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

RUN mkdir -p /app/logs

COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5104
EXPOSE 5104

ENTRYPOINT ["dotnet", "ecg-test2.dll"]
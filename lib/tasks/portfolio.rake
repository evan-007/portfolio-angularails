task import_projects: :environment do
	require 'csv'
	@title = 0
	@lede = 1
	@desc = 2
	@git = 3
	@link = 4

	CSV.foreach("#{Rails.root}/lib/tasks/portfolio-sites.csv") do |row|
		p = Project.new(title: row[@title],
			lede: row[@lede],
			description: row[@desc],
			git: row[@git],
			link: row[@link])
		p.save
	end
end

task build_tags: :environment do
  require 'csv'
  @name = 0
  
  CSV.foreach("#{Rails.root}/lib/tasks/tags.csv") do |row|
    t = Tag.new(name: row[@name])
    t.save
    file = File.open("#{Rails.root}/lib/tasks/images/#{t.name}.png")
    t.avatar = file
    t.save
  end
end

task admin_user: :environment do
	User.first.update(admin: true)
end
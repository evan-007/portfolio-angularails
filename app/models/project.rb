class Project < ActiveRecord::Base
	has_attached_file :image, styles: { :medium => "300x300>", :thumb => "100x100>" }, default_url: "/images/missing.svg"
	validates_attachment_content_type :image, content_type: /\Aimage\/.*\Z/
	
	has_many :tech_tags
	has_many :tags, through: :tech_tags
end
